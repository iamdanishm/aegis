"use server";

import { ai, MODELS } from "@/lib/gemini-client";
import { type Incident } from "@/lib/types";
import { Type } from "@google/genai";

// The Logistics Agent routes assets and checks for road closures using Grounding.
export async function manageLogistics(incident: Incident): Promise<Partial<Incident>> {
    console.log(`[LOGISTICS] Routing assets for incident ${incident.id} at ${incident.location.address || incident.location.lat + "," + incident.location.lng}...`);

    // We only run logistics for high priority items in this demo flow

    const prompt = `
    You are a Logistics Coordinator for emergency response.
    The incident is located at: ${incident.location.address || "Unknown Location (Lat: " + incident.location.lat + ", Lng: " + incident.location.lng + ")"}.
    Incident Category: ${incident.category || "General Emergency"}.
    
    Task:
    1. Search for current road closures or flooding reports in this specific area (Simulated/Real-time). 
       (Note: If this is a simulation, treat the search results as current reality).
    2. Recommend the best asset to deploy (Helicopter, Boat, High-Water Truck).
    
    Output the deployed asset and a brief routing note.
  `;

    try {
        const response = await ai.models.generateContent({
            model: MODELS.LOGISTICS,
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }], // Grounding enabled
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        recommended_asset: { type: Type.STRING },
                        routing_notes: { type: Type.STRING },
                        road_status: { type: Type.STRING }
                    }
                }
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
        const result = JSON.parse(text);

        return {
            assigned_assets: [result.recommended_asset],
            // We can append routing notes to reasoning trace or separate field?
            // For now, let's just log it or maybe assume UI displays assigned_assets.
        };

    } catch (error) {
        console.error("[LOGISTICS] Error managing logistics:", error);
        return {
            assigned_assets: ["Standard Response Vehicle (Fallback)"]
        };
    }
}
