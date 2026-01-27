"use server";

import { ai } from "@/lib/gemini-client";
import { MODELS } from "@/lib/constants";
import { type Incident } from "@/lib/types";
import { triageIncident } from "./triage";
import { analyzeSurveillance } from "./surveillance";

// The Coordinator Agent acts as the "Traffic Cop"
export async function coordinateIncident(incident: Incident): Promise<Incident> {
    console.log(`[COORDINATOR] Received incident ${incident.id} of type ${incident.type}`);

    // Simple Router Logic as per requirements
    // "If input_type == 'audio' -> Route to Triage Agent"
    // "If input_type == 'video' -> Route to Surveillance Agent"

    // In a real scenario, we might use Gemini 3 Flash here to decide routing dynamically,
    // but the requirements specify a deterministic logic for the "Traffic Cop" role based on input type for efficiency,
    // or we can use Flash to extract metadata first.
    // Given the complexity, let's strictly follow the "Logic" from GEMINI.md:

    /*
      Logic:
      * If input_type == "audio" -> Route to Triage Agent.
      * If input_type == "video" -> Route to Surveillance Agent.
      * If input_type == "text" -> Check priority (Self-handle or Route).
    */

    let processedIncident = { ...incident };
    let routingTrace = `[COORDINATOR] Input Type: ${incident.type}. `;

    try {
        if (incident.type === "AUDIO") {
            routingTrace += "Routing task to Triage Agent (Audio Specialist)... ";
            const triageResult = await triageIncident(incident);
            processedIncident = { ...processedIncident, ...triageResult };
        } else if (incident.type === "VIDEO") {
            routingTrace += "Routing task to Surveillance Agent (Vision Specialist)... ";
            const surveillanceResult = await analyzeSurveillance(incident);
            processedIncident = { ...processedIncident, ...surveillanceResult };
        } else if (incident.type === "TEXT") {
            routingTrace += "Routing task to Triage Agent (Text Specialist)... ";
            const triageResult = await triageIncident(incident);
            processedIncident = { ...processedIncident, ...triageResult };
        } else if (incident.type === "COMMAND") {
            routingTrace += "🚨 COMMAND OVERRIDE RECEIVED. Processing Voice Command... ";

            // Voice of God Logic: We treat this as a high-priority Instruction
            // 1. Process Audio to Text (using Triage model for now as it handles audio well, or pure Gemini)
            // 2. Extract Intent

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

            const { models } = await import("@/lib/gemini-client").then(m => m.ai);
            const { Type } = await import("@google/genai");

            const response = await models.generateContent({
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

            const result = JSON.parse(response.text || "{}");
            processedIncident = {
                ...processedIncident,
                ...result,
                priority: "CRITICAL",
                category: "COMMAND_OVERRIDE",
                status: "RESOLVED" // Commands are executed immediately
            };

            routingTrace += `Intent Parsed: ${result.command_intent}`;
        }

        // Secondary Routing: Logistics
        // Logic: If Priority is HIGH/CRITICAL or has explicit override
        if (
            (processedIncident.priority === "HIGH" || processedIncident.priority === "CRITICAL") ||
            (processedIncident.flood_level === "SEVERE" || processedIncident.flood_level === "CRITICAL") ||
            processedIncident.type === "COMMAND" // Always route commands to logistics for global updates
        ) {
            routingTrace += " Initiating Logistics/System Update... ";

            // If it's a command, we might pass it as a "Global Constraint" to logistics?
            // For now, let's just let Logistics "Reason" about it if we were passing state.
            // Since this is a stateless pass, we rely on the Logistics Agent to see the "command_intent" attached to this incident.

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

    return processedIncident;
}
