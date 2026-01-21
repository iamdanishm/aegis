"use server";

import { ai, MODELS } from "@/lib/gemini-client";
import { type Incident } from "@/lib/types";
import { Type } from "@google/genai";

// The Surveillance Agent analyzes drone footage (frames) to assess damage.
export async function analyzeSurveillance(incident: Incident): Promise<Partial<Incident>> {
    console.log(`[SURVEILLANCE] ========================================`);
    console.log(`[SURVEILLANCE] Analyzing drone footage for incident ${incident.id}...`);
    console.log(`[SURVEILLANCE] Using model: ${MODELS.SURVEILLANCE}`);

    // incident.raw_input assumes Base64 string of the image frame.
    // We assume 'raw_input' starts with "data:image/..." or is a raw base64 string.
    const base64Image = incident.raw_input.replace(/^data:image\/\w+;base64,/, "");

    const prompt = `
    Analyze this drone surveillance frame.
    1. Estimate the flood level (Low, Moderate, Severe, Critical).
    2. Identify any visible structural damage to buildings or infrastructure.
    3. Identify any people in danger.
  `;

    try {
        console.log(`[SURVEILLANCE] Sending request to Gemini...`);

        const response = await ai.models.generateContent({
            model: MODELS.SURVEILLANCE,
            contents: [
                { text: prompt },
                {
                    inlineData: {
                        mimeType: "image/jpeg",
                        data: base64Image
                    }
                }
            ],
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        flood_level: { type: Type.STRING, description: "Flood level: Low, Moderate, Severe, or Critical" },
                        structural_damage: { type: Type.STRING, description: "Description of structural damage" },
                        people_count_estimate: { type: Type.NUMBER, description: "Estimated number of people visible" },
                    },
                    required: ["flood_level", "structural_damage"],
                },
            },
        });

        const result = JSON.parse(response.text || "{}");
        console.log(`[SURVEILLANCE] Result: Flood ${result.flood_level}, Damage: ${result.structural_damage}`);
        console.log(`[SURVEILLANCE] ========================================`);

        return {
            flood_level: result.flood_level,
            structural_damage: result.structural_damage,
        };

    } catch (error: any) {
        console.error(`[SURVEILLANCE] ========================================`);
        console.error(`[SURVEILLANCE] Error analyzing frame:`, error.message);
        console.error(`[SURVEILLANCE] ========================================`);
        return {
            flood_level: "Unknown",
            structural_damage: `Analysis Failed: ${error.message}`
        };
    }
}
