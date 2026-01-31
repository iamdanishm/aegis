"use server";

import { ai } from "@/lib/gemini-client";
import { MODELS } from "@/lib/constants";
import { type Incident } from "@/lib/types";
import { triageIncident } from "./triage";
import { analyzeSurveillance } from "./surveillance";
import { Type } from "@google/genai";
import { generateContentWithRetry, extractAndParseJSON } from "@/lib/gemini-utils";

interface RoutingDecision {
    target_agent: "TRIAGE" | "SURVEILLANCE" | "LOGISTICS";
    confidence: number;
    reasoning: string;
}

/**
 * AI-driven routing using Gemini Flash.
 * Dynamically determines which specialized agent should handle the incident.
 */
async function routeWithAI(incident: Incident): Promise<RoutingDecision | null> {
    console.log(`[COORDINATOR] Invoking AI routing for ${incident.id}...`);

    const systemInstruction = `You are the Aegis Coordinator. You are the "Traffic Cop" for an emergency response system.
Analyze the incoming incident data and route it to the correct specialized agent.

Available agents:
- TRIAGE: Handles text and audio distress calls. Analyzes for medical/safety urgency, translates languages, extracts locations.
- SURVEILLANCE: Handles video feeds and CCTV footage. Analyzes drone footage for structural damage, flood levels, people in danger.
- LOGISTICS: Handles resource requests and asset routing. Deploys vehicles, checks road conditions.

Rules:
1. Audio inputs -> TRIAGE (audio specialist)
2. Video inputs -> SURVEILLANCE (vision specialist)
3. Text inputs -> TRIAGE (text analysis)
4. Resource/asset requests -> LOGISTICS
5. Command overrides are processed separately, not routed.

Return ONLY a JSON object with your decision.`;

    const prompt = `
Incident Data:
- ID: ${incident.id}
- Type: ${incident.type}
- Raw Input: ${incident.raw_input.substring(0, 200)}${incident.raw_input.length > 200 ? "..." : ""}
- Location: ${incident.location?.address || `${incident.location?.lat}, ${incident.location?.lng}`}
- Current Status: ${incident.status}
- Description: ${incident.description_for_simulation || "N/A"}

Determine the target agent for this incident.`;

    try {
        const response = await generateContentWithRetry(ai.models, {
            model: MODELS.COORDINATOR,
            contents: prompt,
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        target_agent: {
                            type: Type.STRING,
                            description: "The agent to route to: TRIAGE, SURVEILLANCE, or LOGISTICS"
                        },
                        confidence: {
                            type: Type.NUMBER,
                            description: "Confidence score 0-1"
                        },
                        reasoning: {
                            type: Type.STRING,
                            description: "Brief explanation of routing decision"
                        },
                    },
                    required: ["target_agent", "confidence", "reasoning"],
                },
            },
        });

        const result = extractAndParseJSON(response.text() || "{}");
        console.log(`[COORDINATOR] AI Routing Decision: ${result.target_agent} (confidence: ${result.confidence})`);
        console.log(`[COORDINATOR] AI Reasoning: ${result.reasoning}`);

        return {
            target_agent: result.target_agent as RoutingDecision["target_agent"],
            confidence: result.confidence,
            reasoning: result.reasoning,
        };
    } catch (error: any) {
        console.error(`[COORDINATOR] AI routing failed: ${error.message}`);
        return null; // Signal to use fallback
    }
}

/**
 * Fallback deterministic routing based on incident type.
 * Used when AI routing fails or API key is not available.
 */
function getFallbackRouting(incident: Incident): RoutingDecision {
    let target: RoutingDecision["target_agent"] = "TRIAGE";
    let reasoning = "";

    if (incident.type === "VIDEO") {
        target = "SURVEILLANCE";
        reasoning = "Fallback: Video input routed to Surveillance Agent";
    } else if (incident.type === "AUDIO" || incident.type === "TEXT") {
        target = "TRIAGE";
        reasoning = `Fallback: ${incident.type} input routed to Triage Agent`;
    } else {
        target = "TRIAGE";
        reasoning = "Fallback: Unknown type defaulted to Triage Agent";
    }

    return { target_agent: target, confidence: 0.8, reasoning };
}

// The Coordinator Agent acts as the "Traffic Cop"
export async function coordinateIncident(incident: Incident): Promise<Incident> {
    console.log(`[COORDINATOR] ========================================`);
    console.log(`[COORDINATOR] Received incident ${incident.id} of type ${incident.type}`);

    let processedIncident = { ...incident };
    let routingTrace = `[COORDINATOR] Input Type: ${incident.type}. `;

    try {
        // Handle COMMAND type separately (Voice of God)
        if (incident.type === "COMMAND") {
            routingTrace += "🚨 COMMAND OVERRIDE RECEIVED. Processing Voice Command... ";

            // SIMULATION FALLBACK: If no API key, use mock command result
            if (!process.env.GEMINI_API_KEY) {
                console.log(`[COORDINATOR] [SIMULATION MODE] Processing mock command override for ${incident.id}`);
                const result = {
                    command_intent: incident.command_intent || "EXECUTE ALL PENDING ORDERS",
                    reasoning_trace: "Voice of God command received and authenticated via Aegis Command Protocol. [MOCK]"
                };
                processedIncident = {
                    ...processedIncident,
                    ...result,
                    priority: "CRITICAL",
                    category: "COMMAND_OVERRIDE",
                    status: "RESOLVED"
                };
                routingTrace += `Intent Parsed (MOCK): ${result.command_intent}`;
            } else {
                // Voice of God Logic with AI
                let contextString = "Global Override";
                if (incident.description_for_simulation) {
                    contextString = `Context: ${incident.description_for_simulation}`;
                }

                const commandPrompt = `
                    You are the AI Coordinator receiving a verbal override command from the System Commander (Voice of God).
                    
                    CURRENT CONTEXT: ${contextString}
                    
                    TASKS:
                    1. Transcribe the audio command accurately.
                    2. Extract the CORE INTENT (e.g., "Reroute", "Abort", "Prioritize", "Evacuate").
                    3. Extract specific LOCATIONS or ASSETS mentioned (e.g., "Sector 4", "Dam", "All Units").
                    4. Output a JSON with:
                       - command_intent: Short summary (e.g., "REROUTE ALL UNITS FROM SECTOR 4").
                       - reasoning_trace: Explanation of the command.
                       - priority: "CRITICAL".
                 `;

                // ... existing code ...

                const response = await generateContentWithRetry(ai.models, {
                    model: MODELS.COORDINATOR,
                    contents: [
                        { text: commandPrompt },
                        { inlineData: { mimeType: "audio/webm", data: incident.raw_input.split(',')[1] } }
                    ],
                    config: {
                        responseMimeType: "application/json",
                        responseSchema: {
                            type: Type.OBJECT,
                            properties: {
                                command_intent: { type: Type.STRING },
                                reasoning_trace: { type: Type.STRING },
                            }
                        }
                    }
                });

                const result = extractAndParseJSON(response.text() || "{}");
                processedIncident = {
                    ...processedIncident,
                    ...result,
                    priority: "CRITICAL",
                    category: "COMMAND_OVERRIDE",
                    status: "RESOLVED"
                };

                routingTrace += `Intent Parsed: ${result.command_intent}`;
            }
        } else {
            // AI-DRIVEN ROUTING (Primary logic)
            let routingDecision: RoutingDecision | null = null;

            // Try AI routing first (unless in simulation mode)
            if (process.env.GEMINI_API_KEY) {
                routingDecision = await routeWithAI(incident);
            }

            // Fallback to deterministic routing if AI fails or no API key
            if (!routingDecision) {
                console.log(`[COORDINATOR] Using fallback routing logic`);
                routingDecision = getFallbackRouting(incident);
            }

            routingTrace += `AI Decision: ${routingDecision.target_agent} (${Math.round(routingDecision.confidence * 100)}% confidence). ${routingDecision.reasoning} `;

            // Dispatch to the appropriate agent based on AI decision
            if (routingDecision.target_agent === "TRIAGE") {
                routingTrace += "Routing to Triage Agent... ";
                const triageResult = await triageIncident(incident);
                processedIncident = { ...processedIncident, ...triageResult };
            } else if (routingDecision.target_agent === "SURVEILLANCE") {
                routingTrace += "Routing to Surveillance Agent... ";
                const surveillanceResult = await analyzeSurveillance(incident);
                processedIncident = { ...processedIncident, ...surveillanceResult };
            } else if (routingDecision.target_agent === "LOGISTICS") {
                // Direct logistics routing (rare case)
                routingTrace += "Routing directly to Logistics Agent... ";
                const logisticsResult = await import("./logistics").then(m => m.manageLogistics(incident));
                processedIncident = { ...processedIncident, ...logisticsResult };
            }
        }

        // Secondary Routing: Logistics for high-priority incidents
        if (
            (processedIncident.priority === "HIGH" || processedIncident.priority === "CRITICAL") ||
            (processedIncident.flood_level === "SEVERE" || processedIncident.flood_level === "CRITICAL") ||
            processedIncident.type === "COMMAND"
        ) {
            routingTrace += " Initiating Logistics/System Update... ";
            const logisticsResult = await import("./logistics").then(m => m.manageLogistics(processedIncident));
            processedIncident = { ...processedIncident, ...logisticsResult };
        } else {
            routingTrace += "Standard severity. Logistics stand-by. ";
        }

        processedIncident.coordinator_trace = routingTrace;
    } catch (error: any) {
        console.error("[COORDINATOR] Error routing incident:", error);
        processedIncident.coordinator_trace = routingTrace + ` ERROR: ${error.message}`;
    }

    console.log(`[COORDINATOR] ========================================`);
    return processedIncident;
}
