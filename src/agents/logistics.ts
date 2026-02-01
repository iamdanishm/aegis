"use server";

import { ai } from "@/lib/gemini-client";
import { MODELS } from "@/lib/constants";
import { type Incident } from "@/lib/types";
import { ThinkingLevel, Type } from "@google/genai";

import { MOCK_RESPONSES } from "@/simulation/mock_responses";
import { generateContentStreamWithRetry, extractAndParseJSON } from "@/lib/gemini-utils";

// Helper for cinematic typing effect
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// The Logistics Agent routes assets and checks for road closures using Grounding.
export async function manageLogistics(incident: Incident, onThought?: (thought: string) => void): Promise<Partial<Incident>> {
    // SIMULATION FALLBACK: If no API key, use mock data
    if (!process.env.GEMINI_API_KEY) {
        console.log(`[LOGISTICS] [SIMULATION MODE] Returning mock response for ${incident.id}`);
        const mock = MOCK_RESPONSES[incident.id];

        if (onThought) {
            const mockThoughts = [
                "Checking asset availability...",
                "Querying road closure database...",
                "Calculating optimal route...",
                "Drafting deployment orders..."
            ];
            for (const t of mockThoughts) {
                onThought(t + "\n");
                await new Promise(r => setTimeout(r, 500));
            }
        }

        if (mock && mock.assigned_assets) {
            return {
                assigned_assets: mock.assigned_assets,
                reasoning_trace: mock.reasoning_trace || "Optimized logistics path identified. [MOCK]",
                required_asset: mock.required_asset,
                grounding_queries: mock.grounding_queries
            };
        }
        // ... (Keep existing fallbacks)
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
        if (incident.command_intent === "INVALID_COMMAND" || (incident.reasoning_trace || "").includes("INVALID_COMMAND")) {
            console.log("[LOGISTICS] Command marked INVALID. Requesting NO_ACTION.");
            return {
                assigned_assets: ["NO_ACTION"],
                reasoning_trace: "Command rejected by Coordinator as vague/invalid. No assets deployed.",
                status: "RESOLVED"
            };
        }

        instruction = `
        CRITICAL OVERRIDE: The Commander has issued a direct verbal order: "${incident.command_intent}".
        TASK:
        1. Acknowledge the order.
        2. Identify what assets need to be moved or rerouted.
        3. **STRICT ASSET ALLOW-LIST**:
           - You may ONLY deploy items from this list:
             ["Rescue Boat", "Helicopter", "Drone Swarm", "Patrol Car", "Medical Unit", "Fire Truck", "Ambulance", "Hazmat Team", "SYSTEM_UPDATE"].
           - If the user did not specify one, pick the most logical one or "SYSTEM_UPDATE".
           - DO NOT invent assets like "42 Oak Street" or sentences.
        4. If it's a general update, output "SYSTEM_UPDATE".
        `;
    } else {
        instruction = `
        Task:
        1. TEMPORAL VERIFICATION (CRITICAL):
           - Search for this specific incident code or description to see if it is a "Historical Event" (e.g. from 2024, 2025).
           - Compare any found dates with the CURRENT SYSTEM TIME provided below.
           - If the event appears to be from the past (> 24 hours ago), flag verification_status as "HISTORICAL".
           - If no external confirmation is found but it's a realistic localized signal, flag as "UNVERIFIED" but proceed with caution.
           - If confirmed as happening NOW, flag as "VERIFIED".

        2. Search for current road closures or flooding reports in this specific area using Google Search.
         3. DETERMINE the required asset type: 
            - **CRITICAL RULE**: If verification_status is "HISTORICAL" or "UNVERIFIED", DO NOT recommend high-value assets like "Marine Rescue" or "Blackhawk". Instead, recommend "Drone Surveillance" or "Police Patrol" for initial confirmation.
            - If VERIFIED: "AIR" (if inaccessible), "MARINE" (if flooded), or "GROUND" (if clear).
         4. Recommend the best specific vehicle based on verification status and accessibility.
         5. PRIORITY RE-EVALUATION:
            - If verification_status is "HISTORICAL", you MUST downgrade the incident priority to "LOW".
            - If "UNVERIFIED" but high-stakes, set priority to "MEDIUM".
            - Never allow a "HISTORICAL" event to remain "CRITICAL".
        `;
    }

    const systemInstruction = `
    You are a Logistics Coordinator for Project Aegis.

    ROLE:
    Your job is to route emergency assets (vehicles, boats, aircraft) to incidents based on:
    1. Incident Needs (e.g., Flood -> Boat, Fire -> Firetruck).
    2. Environmental Conditions (e.g., Blocked roads, Weather).
    3. Asset Availability.

    OUTPUT ADHERENCE:
    You must output a strictly valid JSON object.
    - recommended_asset: The best vehicle for the job (or "ALL UNITS" if command implies).
      * MUST be short noun phrase (e.g. "Rescue Boat").
      * NO SENTENCES. NO LOCATIONS.
    - required_asset_type: "AIR" | "MARINE" | "GROUND" | "General".
    - verification_status: "VERIFIED" | "UNVERIFIED" | "HISTORICAL".
    - priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" (Use this to downgrade if historical).
    - routing_notes: Explanation of the route, verification findings, and any hazards.
    - road_status: Summary of road conditions found using Grounding.

    `;

    const userPrompt = `
    CURRENT SYSTEM TIME: ${new Date().toLocaleString("en-US", { timeZone: "UTC" })} UTC
    
    INCIDENT DATA:
    ID: ${incident.id}
    Location: ${incident.location.address || "Unknown (Lat: " + incident.location.lat + ", Lng: " + incident.location.lng + ")"}
    Category: ${incident.category || "General Emergency"}
    Priority: ${incident.priority || "UNKNOWN"}
    Description/Context: ${incident.description_for_simulation || "N/A"}
    
    SPECIAL INSTRUCTIONS:
    ${instruction}
    
    Determine the optimal logistics response and VERIFY the incident timeline.
    `;

    try {
        // ... existing code ...

        const resultStream = await generateContentStreamWithRetry(ai.models, {
            model: MODELS.LOGISTICS,
            contents: [{ text: userPrompt }],
            config: {
                systemInstruction: systemInstruction,
                tools: [{ googleSearch: {} }], // Grounding enabled
                thinkingConfig: {
                    includeThoughts: true,
                    thinkingLevel: ThinkingLevel.HIGH
                }
            },
        });

        let fullText = "";
        let collectedThoughts = "";

        for await (const chunk of resultStream) {
            // Check for grounding metadata in stream chunks
            const metadata = chunk.candidates?.[0]?.groundingMetadata;
            if (metadata?.webSearchQueries) {
                console.log(`[LOGISTICS] Grounding Queries:`, metadata.webSearchQueries);
            }

            const parts = chunk.candidates?.[0]?.content?.parts || [];
            for (const part of parts) {
                if (part.thought) {
                    collectedThoughts += part.text;
                    if (onThought && part.text) {
                        // CINEMATIC SMOOTHING:
                        const chunkText = part.text;
                        for (let i = 0; i < chunkText.length; i += 5) {
                            onThought(chunkText.slice(i, i + 5));
                            await delay(15);
                        }
                    }
                } else if (part.text) {
                    fullText += part.text;
                }
            }
        }

        // ... (JSON parsing logic)
        let result;
        try {
            result = extractAndParseJSON(fullText);
        } catch (e) {
            console.warn("[LOGISTICS] Failed to parse JSON, using fallback text parsing or defaults", fullText);
            result = {
                recommended_asset: incident.type === "COMMAND" ? "SYSTEM UPDATE" : "Standard Rescue Boat",
                routing_notes: fullText.substring(0, 200),
                road_status: "Manual check required due to parsing error."
            };
        }

        // Store raw thoughts in custom field
        (result as any).raw_thoughts = collectedThoughts.trim() || result.reasoning_trace;

        return {
            assigned_assets: [result.recommended_asset],
            required_asset: (result.required_asset_type || "General").toUpperCase() as any,
            reasoning_trace: incident.type === "COMMAND" ? `COMMAND EXECUTED: ${result.routing_notes}` : result.routing_notes,
            verification_status: result.verification_status || "UNVERIFIED",
            priority: result.priority || incident.priority
        };

    } catch (error) {
        console.error("[LOGISTICS] Error managing logistics:", error);
        return {
            assigned_assets: ["Standard Response Vehicle (Fallback)"]
        };
    }
}
