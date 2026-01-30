
import { ai } from "@/lib/gemini-client";
import { MODELS } from "@/lib/constants";
import { Incident } from "@/lib/types";
import { Type } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

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
                // Use THINKING model for Glass Box effect
                const result = await ai.models.generateContentStream({
                    model: MODELS.THINKING,
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
                    if (candidates && candidates.length > 0) {
                        const parts = candidates[0].content.parts;
                        for (const part of parts) {
                            // Check for thought content (Gemini 2.0 Thinking)
                            // Note: The SDK might expose it as 'thought' property or strict parsing needed
                            // For now assuming part.text is content and checking if it's marked as thought if available
                            // Using 'thought' property if typed, else heuristically or checking SDK docs behavior in practice.
                            // In 2.0 flash thinking, thoughts are usually separate parts or streams.

                            // Send raw chunk to client
                            // We stream line-delimited JSON

                            // Detecting thought vs content:
                            // The thinking model returns thoughts in the 'text' but intended for reasoning.
                            // Actually, standard 2.0 thinking returns parts with `thought: true` metadata or similar?
                            // Since we are forcing JSON schema, the "Thinking" process happens *before* the JSON generation.
                            // The model will generate thoughts (text), THEN generate the JSON.

                            // We can heuristically assume early text is thinking if it doesn't look like JSON?
                            // Or simpler: Send EVERYTHING as "thought" until valid JSON is formed?
                            // Or better: Just stream the text.

                            if (part.text) {
                                fullText += part.text;
                                // We send it as "thought" update
                                const event = { type: "thought", content: part.text };
                                controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
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
                        const json = JSON.parse(jsonMatch[0]);
                        const event = { type: "result", data: json };
                        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
                    } else {
                        // Fallback
                        const event = { type: "error", message: "Failed to parse JSON" };
                        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
                    }
                } catch (e) {
                    const event = { type: "error", message: "JSON Parse Error" };
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
