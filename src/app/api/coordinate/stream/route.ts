
import { ai } from "@/lib/gemini-client";
import { MODELS } from "@/lib/constants";
import { Incident } from "@/lib/types";
import { Type } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
    const incident: Incident = await req.json();

    if (!process.env.GEMINI_API_KEY) {
        return NextResponse.json({ error: "No API Key" }, { status: 500 });
    }

    const systemInstruction = `You are the Aegis Coordinator. You are the "Traffic Cop" for an emergency response system. 
    Analyze the incoming incident data and route it to the correct specialized agent.
    
    Available agents:
    - TRIAGE: Handles text and audio distress calls.
    - SURVEILLANCE: Handles video feeds and CCTV footage.
    - LOGISTICS: Handles resource requests and asset routing.
    
    Return ONLY a JSON object with your decision.`;

    const prompt = `
    Incident Data:
    - ID: ${incident.id}
    - Type: ${incident.type}
    - Raw Input: ${incident.raw_input.substring(0, 200)}
    - Location: ${incident.location?.address || `${incident.location?.lat}, ${incident.location?.lng}`}
    - Status: ${incident.status}
    
    Determine the target agent.`;

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        async start(controller) {
            try {
                // Emit initial status for instant UI feedback
                const initEvent = { type: "thought", content: "Coordinator: Analyzing incident inputs..." };
                controller.enqueue(encoder.encode(JSON.stringify(initEvent) + "\n"));

                // Use COORDINATOR model (Flash) for speed, not THINKING (Pro)
                const result = await ai.models.generateContentStream({
                    model: MODELS.COORDINATOR,
                    contents: prompt,
                    config: {
                        systemInstruction: systemInstruction,
                        responseMimeType: "application/json",
                        responseSchema: {
                            type: Type.OBJECT,
                            properties: {
                                target_agent: { type: Type.STRING },
                                confidence: { type: Type.NUMBER },
                                reasoning: { type: Type.STRING },
                            },
                        },
                    },
                });

                let fullText = "";

                for await (const chunk of result) {
                    const candidates = chunk.candidates;
                    if (candidates && candidates.length > 0 && candidates[0].content && candidates[0].content.parts) {
                        const parts = candidates[0].content.parts;
                        for (const part of parts) {
                            if (part.text) {
                                fullText += part.text;
                                // ONLY stream as "thought" if it's NOT looking like the final JSON payload
                                // The Coordinator (Flash) outputs JSON directly. We don't want to show that as "thinking".
                                // Real "thinking" models output text first.
                                if (!fullText.trim().startsWith("{") && !part.text.includes('"target_agent"')) {
                                    const event = { type: "thought", content: part.text };
                                    controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
                                }
                            }
                        }
                    }
                }

                // Final Result Parsing
                // The model was forced to output JSON.
                // We attempt to parse the accumulated text to find the JSON.
                try {
                    // Extract JSON from the mixed thought/content stream
                    const jsonMatch = fullText.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        const routingResult = JSON.parse(jsonMatch[0]);

                        // --- HIT THE SUB-AGENTS ---
                        // The routing decision tells us WHO to call. Now we must actually CALL them.
                        // This logic was missing previously.

                        let agentResult: any = {}; // Use any to access custom fields like raw_thoughts

                        // Define a callback to stream thoughts from sub-agents in REAL-TIME
                        const streamThought = (text: string) => {
                            const event = { type: "thought", content: text };
                            controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
                        };

                        if (routingResult.target_agent === "TRIAGE") {
                            // Import dynamically to avoid side-effects or circular deps if any
                            const { triageIncident } = await import("@/agents/triage");
                            // Pass the stream callback!
                            agentResult = await triageIncident(incident, streamThought);
                        } else if (routingResult.target_agent === "SURVEILLANCE") {
                            const { analyzeSurveillance } = await import("@/agents/surveillance");
                            agentResult = await analyzeSurveillance(incident, streamThought);
                        } else if (routingResult.target_agent === "LOGISTICS") {
                            const { manageLogistics } = await import("@/agents/logistics");
                            agentResult = await manageLogistics(incident, streamThought);
                        }

                        // AGENTIC HANDOFF: If the specialized agent requests physical assets, call Logistics
                        if (agentResult.requires_logistics) {
                            const agentName = routingResult.target_agent;
                            streamThought(`\n[COORDINATOR] ${agentName} requested Logistics Support (Agentic Decision). Initiating Handoff...`);

                            const { manageLogistics } = await import("@/agents/logistics");

                            // Enhanced incident context for Logistics
                            const logisticsInput = {
                                ...incident,
                                ...agentResult, // Pass Triage/Surveillance findings (priority, location, etc.)
                                // If the agent suggested an asset, pass it clearly or let Logistics decide?
                                // Let's pass it as a hint in description or separate field if Logistics supports it.
                                // For now, we trust Logistics to use the enriched data.
                            } as any;

                            const logisticsResult = await manageLogistics(logisticsInput, streamThought);

                            // Stream Logistics Logs if any
                            if ((logisticsResult as any)._audit_logs && Array.isArray((logisticsResult as any)._audit_logs)) {
                                const logs = (logisticsResult as any)._audit_logs;
                                for (const log of logs) {
                                    const event = { type: "audit_log", entry: log };
                                    controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
                                }
                                delete (logisticsResult as any)._audit_logs;
                            }

                            // Merge logistics result (assigned_assets, required_asset) into final result
                            agentResult = { ...agentResult, ...logisticsResult };
                        }

                        // AGENTIC HANDOFF: If the specialized agent requests physical assets, call Logistics
                        if (agentResult.requires_logistics) {
                            // ... existing handoff logic ...
                            // (I need to preserve the handoff logic, but for brevity I will just focus on where to inject the log streaming)
                            // Since replace_file_content replaces the block, I need to be careful not to delete the handoff block if I don't include it.
                            // The handoff block is lines 120-139.
                            // I will target the space AFTER the handoff block, around line 141.
                        }

                        // --- NEW: AUDIT LOG STREAMING ---
                        // Check if the agent returned discrete audit logs (hidden field)
                        if ((agentResult as any)._audit_logs && Array.isArray((agentResult as any)._audit_logs)) {
                            const logs = (agentResult as any)._audit_logs;
                            for (const log of logs) {
                                const event = { type: "audit_log", entry: log };
                                controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
                            }
                            // Clean up
                            delete (agentResult as any)._audit_logs;
                        }

                        // We don't need to dump raw_thoughts here anymore because they were streamed!

                        // Merge the routing reasoning + the agent result
                        const finalResult = {
                            ...incident,
                            ...routingResult, // adds target_agent, confidence, routing_reasoning
                            ...agentResult,   // adds priority, category, detailed reasoning_trace
                            // We might want to combine the reasoning traces?
                            coordinator_trace: routingResult.reasoning, // Keep the coordinator's "why" separate
                        };

                        const event = { type: "result", data: finalResult };
                        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
                    } else {
                        // Fallback
                        const event = { type: "error", message: "Failed to parse JSON" };
                        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
                    }
                } catch (e: any) {
                    const event = { type: "error", message: "Sub-Agent Execution Error: " + e.message };
                    controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
                }

                controller.close();
            } catch (error: any) {
                const event = { type: "error", message: error.message };
                controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
                controller.close();
            }
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    });
}
