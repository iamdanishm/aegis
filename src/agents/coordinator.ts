"use server";

import { ai, MODELS } from "@/lib/gemini-client";
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

    try {
        if (incident.type === "AUDIO") {
            console.log(`[COORDINATOR] Routing to Triage Agent...`);
            const triageResult = await triageIncident(incident);
            processedIncident = { ...processedIncident, ...triageResult };
        } else if (incident.type === "VIDEO") {
            console.log(`[COORDINATOR] Routing to Surveillance Agent...`);
            const surveillanceResult = await analyzeSurveillance(incident);
            processedIncident = { ...processedIncident, ...surveillanceResult };
        } else if (incident.type === "TEXT") {
            console.log(`[COORDINATOR] Handling Text Incident...`);
            // We can use the Triage agent for text as well since it specializes in "Distress calls"
            const triageResult = await triageIncident(incident);
            processedIncident = { ...processedIncident, ...triageResult };
        }
    } catch (error) {
        console.error("[COORDINATOR] Error routing incident:", error);
        // Fallback?
    }

    return processedIncident;
}
