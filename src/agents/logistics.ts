"use server";

import { ai } from "@/lib/gemini-client";
import { MODELS } from "@/lib/constants";
import { type Incident } from "@/lib/types";
import { Type } from "@google/genai";

// The Logistics Agent routes assets and checks for road closures using Grounding.
export async function manageLogistics(incident: Incident): Promise<Partial<Incident>> {
    console.log(`[LOGISTICS] Routing assets for incident ${incident.id} at ${incident.location.address || incident.location.lat + "," + incident.location.lng}...`);

    // We only run logistics for high priority items in this demo flow

    // PROTOCOL ZERO: Safety Valve Check
    if (incident.requires_human_auth) {
        if (!incident.auth_status || incident.auth_status === "PENDING") {
            console.log(`[LOGISTICS] ⏸️ PAUSING for Human Authorization: ${incident.id}`);
            return {
                status: "TRIAGED", // Keep it active in the list, but effectively paused from final resolution
                reasoning_trace: "⚠️ PROTOCOL ZERO ACTIVE: High-stakes decision requires COMMANDER AUTHORIZATION. Holding for approval...",
                assigned_assets: ["AWAITING AUTH"]
            };
        } else if (incident.auth_status === "DENIED") {
            return {
                status: "RESOLVED",
                reasoning_trace: "🚫 ACTION DENIED by Commander. Aborting deployment.",
                assigned_assets: ["ABORTED"]
            };
        }
        // If APPROVED, we proceed to standard logic below...
    }

    // Voice of God Override Logic
    // If this is a COMMAND incident, the goal is to "execute" the logistics update.
    let instruction = "";
    if (incident.type === "COMMAND") {
        instruction = `
        CRITICAL OVERRIDE: The Commander has issued a direct verbal order: "${incident.command_intent}".
        TASK:
        1. Acknowledge the order.
        2. Identify what assets need to be moved or rerouted.
        3. Output "acknowledged_action" instead of just recommending an asset.
        `;
    } else {
        instruction = `
        Task:
        1. Search for current road closures or flooding reports in this specific area using Google Search.
        2. Recommend the best asset to deploy (Helicopter, Boat, High-Water Truck) based on accessibility.
        `;
    }

    const prompt = `
    You are a Logistics Coordinator for emergency response.
    The incident is located at: ${incident.location.address || "Unknown Location (Lat: " + incident.location.lat + ", Lng: " + incident.location.lng + ")"}.
    Incident Category: ${incident.category || "General Emergency"}.
    Priority: ${incident.priority || "UNKNOWN"}.
    
    ${instruction}
    
    Output a JSON object with:
    - recommended_asset: The best vehicle for the job (or "ALL UNITS" if command implies).
    - routing_notes: Explanation of the route and any hazards (or acknowledgement of command).
    - road_status: Summary of road conditions found.
  `;

    try {
        const response = await ai.models.generateContent({
            model: MODELS.LOGISTICS,
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }], // Grounding enabled
            },
            // Note: Grounding with JSON schema is supported in Gemini 1.5 Pro/Flash and newer.
            // If schema causes issues with Grounding (sometimes it does), we might need to parse text.
            // But Gemini 3 supports this well.
        });

        // Check for grounding metadata
        const metadata = response.candidates?.[0]?.groundingMetadata;
        if (metadata && metadata.webSearchQueries) {
            console.log(`[LOGISTICS] Grounding Queries:`, metadata.webSearchQueries);
        }

        const text = response.text || "{}";
        // If Grounding returns text that isn't strict JSON despite schema (edge case), we try catch.
        let result;
        try {
            // Robust JSON parsing: clean markdown code blocks
            let cleanText = text.replace(/```json/g, "").replace(/```/g, "").trim();
            // Find the first and last curly braces to isolate the JSON object
            const firstOpen = cleanText.indexOf('{');
            const lastClose = cleanText.lastIndexOf('}');

            if (firstOpen !== -1 && lastClose !== -1) {
                cleanText = cleanText.substring(firstOpen, lastClose + 1);
                result = JSON.parse(cleanText);
            } else {
                // Fallback if no braces found (unlikely with this prompt)
                throw new Error("No JSON object found in response");
            }
        } catch (e) {
            console.warn("[LOGISTICS] Failed to parse JSON, using fallback text parsing or defaults", text);
            result = {
                recommended_asset: incident.type === "COMMAND" ? "SYSTEM UPDATE" : "Standard Rescue Boat",
                routing_notes: text.substring(0, 200), // Keep more text
                road_status: "Manual check required due to parsing error."
            };
        }

        return {
            assigned_assets: [result.recommended_asset],
            reasoning_trace: incident.type === "COMMAND" ? `COMMAND EXECUTED: ${result.routing_notes}` : result.routing_notes
        };


    } catch (error) {
        console.error("[LOGISTICS] Error managing logistics:", error);
        return {
            assigned_assets: ["Standard Response Vehicle (Fallback)"]
        };
    }
}
