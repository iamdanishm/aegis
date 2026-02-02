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
1. If Type is provided, respect it.
2. If Type is missing/unknown, analyze Raw Input file extension:
   - Audio (.mp3, .wav) -> TRIAGE
   - Video (.mp4, .mov, .avi) -> SURVEILLANCE
   - Text -> TRIAGE
3. Resource requests -> LOGISTICS
Return ONLY a JSON object with your decision.`;

    const prompt = `
Incident Data:
- ID: ${incident.id}
- Type: ${incident.type || "UNKNOWN (Infer from Input)"}
- Raw Input: ${incident.raw_input.substring(0, 200)}${incident.raw_input.length > 200 ? "..." : ""}
- Location: ${incident.location?.address || `${incident.location?.lat}, ${incident.location?.lng}`}
- Current Status: ${incident.status}
- Description: ${incident.description_for_simulation || "N/A"}
${incident.transcript_context ? `\n[ACTION REQUIRED]: User has provided context: "${incident.transcript_context}". Route based on this NEW context.` : ""}

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

        const text = (typeof response.text === 'function') ? response.text() : (response.candidates?.[0]?.content?.parts?.[0]?.text || "{}");
        const result = extractAndParseJSON(text);
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

    const input = (incident.raw_input || "").toLowerCase();
    const isVideo = incident.type === "VIDEO" || input.endsWith(".mp4") || input.endsWith(".mov") || input.endsWith(".avi");
    const isAudio = incident.type === "AUDIO" || input.endsWith(".mp3") || input.endsWith(".wav");

    if (isVideo) {
        target = "SURVEILLANCE";
        reasoning = "Fallback: Video input (inferred/explicit) routed to Surveillance Agent";
    } else if (isAudio || incident.type === "TEXT") {
        target = "TRIAGE";
        reasoning = "Fallback: Audio/Text input routed to Triage Agent";
    } else {
        target = "TRIAGE";
        reasoning = "Fallback: Unknown type defaulted to Triage Agent";
    }

    return { target_agent: target, confidence: 0.8, reasoning };
}

/**
 * Parses user command directive to update internal state.
 */
async function parseDirective(incident: Incident): Promise<{ command_intent: string, reasoning_trace: string }> {
    if (!process.env.GEMINI_API_KEY) {
        return {
            command_intent: incident.transcript_context || "Directive processed via Aegis Protocol.",
            reasoning_trace: "System Commander directive received and authenticated. Priority re-alignment initiated. [MOCK]"
        };
    }

    const prompt = `
        You are the Aegis Directive Parser.
        Extract the commander's intent from this voice context: "${incident.transcript_context}"
        
        Output a JSON with:
        - command_intent: Short summary (e.g., "DEPLOY DRONE TO SECTOR 4").
        - reasoning_trace: Brief explanation of the directive.
    `;

    try {
        const response = await generateContentWithRetry(ai.models, {
            model: MODELS.COORDINATOR,
            contents: [{ text: prompt }],
            config: {
                responseMimeType: "application/json"
            }
        });
        const text = (typeof response.text === 'function') ? response.text() : (response.candidates?.[0]?.content?.parts?.[0]?.text || "{}");
        const result = extractAndParseJSON(text);
        return {
            command_intent: result.command_intent || "Executed",
            reasoning_trace: result.reasoning_trace || "Commander intent acknowledged."
        };
    } catch (e) {
        return {
            command_intent: "SYSTEM_UPDATE",
            reasoning_trace: "Commander directive processed via fallback protocol."
        };
    }
}

// The Coordinator Agent acts as the "Traffic Cop"
export async function coordinateIncident(incident: Incident): Promise<Incident> {
    console.log(`[COORDINATOR] ========================================`);
    console.log(`[COORDINATOR] Received incident ${incident.id} of type ${incident.type || "UNKNOWN"}`);

    let processedIncident = { ...incident };
    let routingTrace = `[COORDINATOR] Input Type: ${incident.type || "UNKNOWN (Auto-Inferred)"}. `;

    // For Dual Analysis: Handle directive parsing separately if context exists
    let directiveResult: { command_intent: string, reasoning_trace: string } | null = null;
    if (incident.transcript_context) {
        directiveResult = await parseDirective(incident);
        // Inject context into description so specialists see it
        incident.description_for_simulation = `[USER CONTEXT]: ${incident.transcript_context}\n${incident.description_for_simulation || ""}`;
    }

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
                    status: "RESOLVED",
                    location: incident.location || processedIncident.location // Keep existing or use provided
                };
                routingTrace += `Intent Parsed (MOCK): ${result.command_intent}`;
            } else {
                // Voice of God Logic: Check if we have pre-transcribed text or need to process audio
                let contextString = "Global Override";
                if (incident.description_for_simulation) {
                    contextString = `Context: ${incident.description_for_simulation}`;
                }

                // INJECT USER CONTEXT FROM MERGE
                if (incident.transcript_context) {
                    // This is the magic line that makes the AI aware of the merge
                    contextString += `\n\n[USER VOICE INJECTION]: "${incident.transcript_context}"\n(You must incorporate this user directive into your analysis).`;
                    console.log("[COORDINATOR] Injecting User Context into Prompt:", incident.transcript_context);
                }

                let commandText = "";
                let isAudioInput = incident.raw_input.startsWith("data:audio");

                if (!isAudioInput || incident.command_intent) {
                    // Pre-transcribed text or passed intent
                    commandText = incident.command_intent || incident.raw_input;
                    console.log(`[COORDINATOR] Processing Text Command: "${commandText}"`);
                }

                // If we have text, we use a text-only prompt
                if (commandText) {
                    const textCommandPrompt = `
                        You are the AI Coordinator receiving a text-based override command from the System Commander.
                        
                        CURRENT CONTEXT: ${contextString}
                        COMMAND: "${commandText}"
                        
                        TASKS:
                        1. **CRITICAL: ACTIONABILITY CHECK**:
                           - If the command is vague (e.g., just a place name like "United States", "New York") BUT seems to be setting context, output:
                             - command_intent: "INFO_UPDATE: [Human provided context]"
                           - If it is completely nonsense, output:
                             - command_intent: "INVALID_COMMAND"
                             - reasoning_trace: "Command rejected: Too vague or non-actionable."
                           - ONLY proceed if there is a clear imperative OR a clear information update.

                        2. Analyze the command intent (e.g., "Reroute", "Abort", "Prioritize", "Evacuate", "Update Context").
                        3. Extract specific LOCATIONS or ASSETS mentioned. If a new address is mentioned, you MUST provide it in the 'location' field.
                        4. Output a JSON with:
                           - command_intent: Short summary (e.g., "REROUTE ALL UNITS FROM SECTOR 4").
                           - reasoning_trace: Explanation of the command processing.
                           - priority: "CRITICAL" (Standard) or specific level requested.
                           - location: { lat: number, lng: number, address: string } (ONLY if new location is identified).
                    `;

                    const response = await generateContentWithRetry(ai.models, {
                        model: MODELS.COORDINATOR,
                        contents: [{ text: textCommandPrompt }],
                        config: {
                            responseMimeType: "application/json",
                            responseSchema: {
                                type: Type.OBJECT,
                                properties: {
                                    command_intent: { type: Type.STRING },
                                    reasoning_trace: { type: Type.STRING },
                                    priority: { type: Type.STRING, enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
                                    location: {
                                        type: Type.OBJECT,
                                        properties: {
                                            lat: { type: Type.NUMBER },
                                            lng: { type: Type.NUMBER },
                                            address: { type: Type.STRING }
                                        }
                                    }
                                }
                            }
                        }
                    });

                    const text = (typeof response.text === 'function') ? response.text() : (response.candidates?.[0]?.content?.parts?.[0]?.text || "{}");
                    const result = extractAndParseJSON(text);
                    processedIncident = {
                        ...processedIncident,
                        ...result,
                        priority: "CRITICAL",
                        category: "COMMAND_OVERRIDE",
                        status: "RESOLVED"
                    };
                    routingTrace += `Intent Parsed: ${result.command_intent}`;

                } else {
                    // Original Audio Processing Path
                    const commandPrompt = `
                        You are the AI Coordinator receiving a verbal override command from the System Commander (Voice of God).
                        
                        CURRENT CONTEXT: ${contextString}
                        
                        TASKS:
                        1. Transcribe the audio command accurately.
                        2. **CRITICAL: ACTIONABILITY CHECK**:
                           - If the command is vague (e.g. "United States", "Hello", "Testing") BUT seems to be setting context (e.g. "The city is New York"), output:
                             - command_intent: "INFO_UPDATE: [Human provided context]"
                           - If it is completely nonsense or greeting with no info, output:
                             - command_intent: "INVALID_COMMAND"
                             - reasoning_trace: "Command rejected: Audio input was vague or non-actionable."
                        3. Extract the CORE INTENT (e.g., "Reroute", "Abort", "Prioritize", "Evacuate", "Update Context").
                        4. Extract specific LOCATIONS or ASSETS mentioned. If a new address is mentioned, you MUST provide it in the 'location' field.
                        5. Output a JSON with:
                           - command_intent: Short summary (e.g., "REROUTE ALL UNITS FROM SECTOR 4").
                           - reasoning_trace: Explanation of the command.
                           - priority: "CRITICAL" (Standard) or specific level requested.
                           - location: { lat: number, lng: number, address: string } (ONLY if new location is identified).
                     `;

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
                                    priority: { type: Type.STRING, enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
                                    location: {
                                        type: Type.OBJECT,
                                        properties: {
                                            lat: { type: Type.NUMBER },
                                            lng: { type: Type.NUMBER },
                                            address: { type: Type.STRING }
                                        }
                                    }
                                }
                            }
                        }
                    });

                    const text = (typeof response.text === 'function') ? response.text() : (response.candidates?.[0]?.content?.parts?.[0]?.text || "{}");
                    const result = extractAndParseJSON(text);
                    processedIncident = {
                        ...processedIncident,
                        ...result,
                        priority: "CRITICAL",
                        category: "COMMAND_OVERRIDE",
                        status: "RESOLVED"
                    };

                    routingTrace += `Intent Parsed: ${result.command_intent}`;
                }
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

            // MERGE DIRECTIVE TRACE IF PRESENT
            if (directiveResult) {
                processedIncident.command_intent = directiveResult.command_intent;
                processedIncident.reasoning_trace = `${processedIncident.reasoning_trace}\n\n[COMMAND OVERRIDE]: ${directiveResult.command_intent}\n${directiveResult.reasoning_trace}`.trim();
            }
        }

        // ================================================================
        // COMMAND RE-ROUTING: Route commands to appropriate specialist agents
        // (Issue 4 fix: Commands should route based on intent, not just to Logistics)
        // ================================================================
        let commandWasReRouted = false;
        if (incident.type === "COMMAND" && processedIncident.command_intent) {
            const intent = (processedIncident.command_intent || "").toUpperCase();

            // Detect command type by keywords
            const isVideoRelated = /RECHECK|RE-CHECK|ANALYZE.*VIDEO|VIDEO|SURVEILLANCE|FOOTAGE|DRONE|CAMERA|VISUAL|REANALYZE|RE-ANALYZE|VERIFY.*FOOTAGE/i.test(intent);
            const isTriageRelated = /TRIAGE|CALL|AUDIO|DISTRESS|MEDICAL|PRIORITY|REASSESS|RE-ASSESS|RECHECK.*CALL|VERIFY.*PRIORITY/i.test(intent);

            if (isVideoRelated) {
                console.log(`[COORDINATOR] Command \"${intent}\" detected as video-related. Re-routing to Surveillance Agent...`);
                routingTrace += ` [COMMAND REROUTE] \"${intent}\" → Surveillance Agent... `;

                const surveillanceResult = await analyzeSurveillance({
                    ...processedIncident,
                    type: "VIDEO",  // Hint to agent
                    description_for_simulation: `[COMMAND]: ${intent}\n${processedIncident.description_for_simulation || ""}`
                });

                const existingTrace = processedIncident.reasoning_trace || "";
                processedIncident = {
                    ...processedIncident,
                    ...surveillanceResult,
                    reasoning_trace: `${existingTrace}\n\n[SURVEILLANCE RECHECK]:\n${surveillanceResult.reasoning_trace || ""}`.trim()
                };
                commandWasReRouted = true;

            } else if (isTriageRelated) {
                console.log(`[COORDINATOR] Command \"${intent}\" detected as triage-related. Re-routing to Triage Agent...`);
                routingTrace += ` [COMMAND REROUTE] \"${intent}\" → Triage Agent... `;

                const triageResult = await triageIncident({
                    ...processedIncident,
                    type: "AUDIO",  // Hint to agent
                    description_for_simulation: `[COMMAND]: ${intent}\n${processedIncident.description_for_simulation || ""}`
                });

                const existingTrace = processedIncident.reasoning_trace || "";
                processedIncident = {
                    ...processedIncident,
                    ...triageResult,
                    reasoning_trace: `${existingTrace}\n\n[TRIAGE REASSESSMENT]:\n${triageResult.reasoning_trace || ""}`.trim()
                };
                commandWasReRouted = true;
            }
        }

        // Secondary Routing: Logistics for high-priority incidents
        // Skip for commands that were already re-routed to specialist agents
        const shouldRouteToLogistics = (
            (processedIncident.priority === "HIGH" || processedIncident.priority === "CRITICAL") ||
            (processedIncident.flood_level === "SEVERE" || processedIncident.flood_level === "CRITICAL") ||
            (processedIncident.type === "COMMAND" && !commandWasReRouted) ||  // Only route commands that weren't re-routed
            processedIncident.requires_logistics === true ||
            processedIncident.suggested_asset_type?.includes("DRONE")
        );

        if (shouldRouteToLogistics) {
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
