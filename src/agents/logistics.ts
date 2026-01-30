"use server";

import { ai } from "@/lib/gemini-client";
import { MODELS } from "@/lib/constants";
import { type Incident } from "@/lib/types";
import { Type } from "@google/genai";

import { MOCK_RESPONSES } from "@/simulation/mock_responses";

// The Logistics Agent routes assets and checks for road closures using Grounding.
export async function manageLogistics(incident: Incident): Promise<Partial<Incident>> {
    // SIMULATION FALLBACK: If no API key, use mock data
    if (!process.env.GEMINI_API_KEY) {
        console.log(`[LOGISTICS] [SIMULATION MODE] Returning mock response for ${incident.id}`);
        const mock = MOCK_RESPONSES[incident.id];
        if (mock && mock.assigned_assets) {
            return {
                assigned_assets: mock.assigned_assets,
                reasoning_trace: mock.reasoning_trace || "Optimized logistics path identified. [MOCK]",
                required_asset: mock.required_asset,
                grounding_queries: mock.grounding_queries
            };
        }

        // Command fallback
        if (incident.type === "COMMAND") {
            return {
                assigned_assets: ["ALL UNITS"],
                reasoning_trace: `COMMAND EXECUTED: ${incident.command_intent || "Global Reroute"}. System state updated. [MOCK]`
            };
        }

        // Generic fallback
        return {
            assigned_assets: ["Standard Response Team"],
            reasoning_trace: "Logistics analysis complete. Deploying standard response team to location. [MOCK]"
        };
    }
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
        2. DETERMINE the required asset type: "AIR" (if inaccessible), "MARINE" (if flooded), or "GROUND" (if clear).
        3. Recommend the best specific vehicle (e.g., "Rescue Boat", "Blackhawk") based on accessibility.
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
    - required_asset_type: "AIR" | "MARINE" | "GROUND" | "General".
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
        const queries = metadata?.webSearchQueries || [];
        if (queries.length > 0) {
            console.log(`[LOGISTICS] Grounding Queries:`, queries);
        }

        const text = response.text || "{}";
        // ... (JSON parsing logic remains the same)
        let result;
        try {
            // Robust JSON extraction using regex
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error("Failed to extract JSON from model response");
            }
            const cleanJson = jsonMatch[0];
            result = JSON.parse(cleanJson);
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
            required_asset: (result.required_asset_type || "General").toUpperCase() as any,
            reasoning_trace: incident.type === "COMMAND" ? `COMMAND EXECUTED: ${result.routing_notes}` : result.routing_notes,
            grounding_queries: queries
        };


    } catch (error) {
        console.error("[LOGISTICS] Error managing logistics:", error);
        return {
            assigned_assets: ["Standard Response Vehicle (Fallback)"]
        };
    }
}
