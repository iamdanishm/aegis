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
        }

        // Secondary Routing: Logistics
        if (
            (processedIncident.priority === "HIGH" || processedIncident.priority === "CRITICAL") ||
            (processedIncident.flood_level === "SEVERE" || processedIncident.flood_level === "CRITICAL")
        ) {
            routingTrace += "High Priority detected. Initiating Logistics Agent for asset routing... ";
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
