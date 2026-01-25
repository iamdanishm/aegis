"use server";

import { ai } from "@/lib/gemini-client";
import { MODELS } from "@/lib/constants";
import { type Incident } from "@/lib/types";
import { Type } from "@google/genai";
import fs from "fs";
import path from "path";

// The Surveillance Agent analyzes drone footage (frames or videos) to assess damage.
export async function analyzeSurveillance(incident: Incident): Promise<Partial<Incident>> {
    console.log(`[SURVEILLANCE] ========================================`);
    console.log(`[SURVEILLANCE] Analyzing drone footage for incident ${incident.id}...`);
    console.log(`[SURVEILLANCE] Using model: ${MODELS.SURVEILLANCE}`);

    // Load the actual video/media file for analysis
    let mediaData = "";
    let mimeType = "video/mp4"; // Default

    if (incident.raw_input.startsWith("/")) {
        const filePath = path.join(process.cwd(), "public", incident.raw_input);
        if (fs.existsSync(filePath)) {
            const fileExtension = path.extname(filePath).toLowerCase();
            const fileData = fs.readFileSync(filePath);
            mediaData = fileData.toString("base64");

            // Map extensions to MIME types
            if (fileExtension === ".mov") {
                mimeType = "video/quicktime";
            } else if (fileExtension === ".mp4") {
                mimeType = "video/mp4";
            } else if (fileExtension === ".jpg" || fileExtension === ".jpeg") {
                mimeType = "image/jpeg";
            } else if (fileExtension === ".png") {
                mimeType = "image/png";
            }

            console.log(`[SURVEILLANCE] Loaded media: ${filePath} (${(fileData.length / 1024 / 1024).toFixed(2)} MB)`);
        }
    } else {
        mediaData = incident.raw_input.replace(/^data:video\/\w+;base64,/, "");
    }

    const prompt = `
    You are an AI Surveillance Officer. You are analyzing a drone video stream or image feed.
    
    TACTICAL CONTEXT:
    ID: ${incident.id}
    Location: ${incident.location.address}
    
    ANALYSIS TASKS:
    1. Analyze the attached video/media carefully.
    2. Estimate the flood level (Low, Moderate, Severe, Critical).
    3. Identify structural damage and people in danger.
    5. LOCATION VERIFICATION: Can you identify the specific location or landmark from visual cues?
       - If yes, extract it as specific_location_name.
       - Estimate lat/long if possible based on landmarks.
    6. PEOPLE ANALYSIS: Estimate number of people and their safety status (SAFE, TRAPPED, INJURED, DANGER).
    7. Identify the Category (e.g. Natural Disaster, Accident, Fire, Flood, etc).
    8. Provide a detailed reasoning trace.
  `;

    try {
        console.log(`[SURVEILLANCE] Sending request to Gemini with actual media data...`);

        const contents: any[] = [
            { text: prompt },
            {
                inlineData: {
                    mimeType: mimeType,
                    data: mediaData
                }
            }
        ];

        const response = await ai.models.generateContent({
            model: MODELS.SURVEILLANCE,
            contents: contents,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        flood_level: { type: Type.STRING },
                        structural_damage: { type: Type.STRING },
                        people_count_estimate: { type: Type.NUMBER },
                        reasoning_trace: { type: Type.STRING },
                        specific_location_name: { type: Type.STRING, description: "Identified landmark or specific address from visual cues, or null." },
                        estimated_lat: { type: Type.NUMBER, description: "Estimated latitude of identified landmark, or null." },
                        estimated_lng: { type: Type.NUMBER, description: "Estimated longitude of identified landmark, or null." },
                        category: { type: Type.STRING, description: "Category of the incident (Natural Disaster, Accident, etc)" },
                        people_safety: { type: Type.STRING, description: "Safety status of people: SAFE, TRAPPED, INJURED, DANGER, or NONE" },
                    },
                    required: ["flood_level", "structural_damage", "reasoning_trace", "category"],
                },
            },
        });

        const result = JSON.parse(response.text || "{}");
        console.log(`[SURVEILLANCE] Result for ${incident.id}: Flood ${result.flood_level}, Damage: ${result.structural_damage}`);

        // Calculate Priority
        let calculatedPriority = "LOW";
        const flood = (result.flood_level || "").toLowerCase();
        const damage = (result.structural_damage || "").toLowerCase();

        if (flood.includes("critical") || flood.includes("severe") || damage.includes("collapse") || damage.includes("destroyed")) {
            calculatedPriority = "CRITICAL";
        } else if (flood.includes("moderate") || damage.includes("severe") || damage.includes("major")) {
            calculatedPriority = "HIGH";
        } else if (flood.includes("low") || damage.includes("moderate")) {
            calculatedPriority = "MEDIUM";
        }

        // Human Factor Overwrites
        const peopleCount = result.people_count_estimate || 0;
        const safety = (result.people_safety || "").toLowerCase();

        if (peopleCount > 0) {
            if (safety.includes("danger") || safety.includes("trapped") || safety.includes("injured") || safety.includes("critical")) {
                calculatedPriority = "CRITICAL";
            } else if (calculatedPriority === "LOW" || calculatedPriority === "MEDIUM") {
                // If people are present but seemingly safe, bump minimal priority to High just in case
                calculatedPriority = "HIGH";
            }
        }

        console.log(`[SURVEILLANCE] Assigned Priority: ${calculatedPriority}`);
        console.log(`[SURVEILLANCE] ========================================`);


        const responseObj: Partial<Incident> = {
            flood_level: result.flood_level,
            structural_damage: result.structural_damage,
            reasoning_trace: result.reasoning_trace,
            category: result.category || "Surveillance Alert",
            priority: calculatedPriority as any, // Cast to Priority type
            status: "TRIAGED"
        };

        if (result.specific_location_name && result.estimated_lat && result.estimated_lng) {
            console.log(`[SURVEILLANCE] VISUAL LOCATION MATCH: ${result.specific_location_name} (${result.estimated_lat}, ${result.estimated_lng})`);
            responseObj.location = {
                lat: result.estimated_lat,
                lng: result.estimated_lng,
                address: result.specific_location_name
            };
        }

        return responseObj;

    } catch (error: any) {
        console.error(`[SURVEILLANCE] ========================================`);
        console.error(`[SURVEILLANCE] Error analyzing frame:`, error.message);
        console.error(`[SURVEILLANCE] ========================================`);
        return {
            flood_level: "Unknown",
            structural_damage: `Analysis Failed: ${error.message}`,
            reasoning_trace: `Error: ${error.message}`
        };
    }
}
