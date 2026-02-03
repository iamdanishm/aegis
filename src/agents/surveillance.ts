"use server";

import { ai } from "@/lib/gemini-client";
import { MODELS } from "@/lib/constants";
import { type Incident } from "@/lib/types";
import { ThinkingLevel, Type } from "@google/genai";
import fs from "fs";
import path from "path";
import { generateContentStreamWithRetry, extractAndParseJSON } from "@/lib/gemini-utils";

import { MOCK_RESPONSES } from "@/simulation/mock_responses";

// The Surveillance Agent analyzes drone footage (frames or videos) to assess damage.
export async function analyzeSurveillance(incident: Incident, onThought?: (thought: string) => void): Promise<Partial<Incident>> {
    // SIMULATION FALLBACK: If no API key, use mock data
    if (!process.env.GEMINI_API_KEY) {
        console.log(`[SURVEILLANCE] [SIMULATION MODE] Returning mock response for ${incident.id}`);
        const mock = MOCK_RESPONSES[incident.id];

        if (onThought) {
            const mockThoughts = [
                "Scanning frame for flood markers...",
                "Identifying structural cracks...",
                "Estimating people count...",
                "Triangulating location from landmarks..."
            ];
            for (const t of mockThoughts) {
                onThought(t + "\n");
                await new Promise(r => setTimeout(r, 500));
            }
        }

        const context = incident.transcript_context || "";
        if (context) {
            return {
                id: incident.id,
                priority: "CRITICAL",
                category: "SURVEILLANCE",
                reasoning_trace: `[System Commander Override] Visual sensors recalibrated to target: ${context}. Structural assessment confirmed life-safety risk.`,
                display_reasoning: [
                    "Commander override active",
                    "Visual sensors recalibrated",
                    "Life-safety risk confirmed"
                ],
                status: "TRIAGED"
            };
        }

        if (mock) {
            return {
                ...mock,
                status: "TRIAGED"
            };
        }
        // Generic fallback
        return {
            flood_level: "Low",
            structural_damage: "Minimal",
            reasoning_trace: "No specific mock data found. Analysis based on standard detection algorithms. [MOCK]",
            display_reasoning: [
                "Low flood level detected",
                "Minimal structural damage",
                "Standard monitoring active"
            ],
            category: "General Surveillance",
            priority: "LOW",
            status: "TRIAGED"
        };
    }
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
        } else {
            console.error(`[SURVEILLANCE] File not found: ${filePath}`);
            throw new Error(`Video file not found at path: ${incident.raw_input}`);
        }
    } else {
        mediaData = incident.raw_input.replace(/^data:video\/\w+;base64,/, "");
    }

    const systemInstruction = `
    You are an AI Surveillance Officer. You are analyzing a drone video stream or image feed.

    ANALYSIS TASKS:
    1. VISUAL FORENSICS (CRITICAL):
       - If coordinates are MISSING (0,0) or unknown, you MUST analyze the visual frame for LOCATION CLUES.
       - Look for: Street Signs, Landmarks, Business Names, License Plates, distinctive geography.
       - Use Google Search Grounding (if available) to find the final address after verification.
       - Output the inferred location in 'extracted_address', 'extracted_lat', 'extracted_lng'.
       - Set 'location_source' to "VISUAL_LANDMARK".
    
    2. Analyze the video frame/image for structural damage and flood levels.
    3. AUTHENTICITY CHECK: Look for visual indicators of re-circulated footage (e.g., date stamps in the past, mismatched weather, low-resolution artifacts).
    4. Determine the CATEGORY.
    5. Provide a REASONING TRACE.
    6. LOGISTICS HANDOFF: Decide if this incident requires physical asset deployment.

    7. DISPLAY REASONING (HUD BULLETS):
       - Generate exactly 3 short, telegraphic bullet points for tactical HUD display.
       - Each bullet: MAX 10 words. Military-style. No filler words.
       - Focus on: Damage assessment, threat level, recommended action.
       - Example:
         • "Structural collapse - 40% building integrity"
         • "2 civilians visible on rooftop"
         • "Flood level rising - EVAC priority"

    USER OVERRIDE PROTOCOL (CRITICAL):
    - If the "Description/Alert" input contains specific location instructions (e.g. "[USER CONTEXT]: Confirm location is X"), you MUST:
      1. Verify this claim using Visuals + Google Search.
      2. If verified, UPDATE 'extracted_address', 'extracted_lat', 'extracted_lng' to match the user's location.
      3. Set 'location_source' to "VISUAL_LANDMARK" (verified).
    
    PRIORITY RULES (STRICT):
    - If you suspect the footage is HISTORICAL or FAKE (mismatched metadata/visuals), set is_authentic = false and priority = LOW.
    - If unverified but plausible, set priority = MEDIUM and request "DRONE_VERIFICATION".
    - CRITICAL is reserved for verified, immediate threats found in authentic footage.
    `;

    const userPrompt = `
    TACTICAL CONTEXT:
    ID: ${incident.id}
    Location: ${incident.location.address}
    Description/Alert: ${incident.description_for_simulation || "N/A"}
    
    Analyze the attached media feed.
    `;

    // RETRY WRAPPER
    let lastError: any;
    const MAX_RETRIES = 3;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            console.log(`[SURVEILLANCE] Sending request to Gemini (Stream) - Attempt ${attempt}/${MAX_RETRIES}...`);

            const contents: any[] = [
                { text: userPrompt },
                {
                    inlineData: {
                        mimeType: mimeType,
                        data: mediaData
                    }
                }
            ];

            const resultStream = await generateContentStreamWithRetry(ai.models, {
                model: MODELS.SURVEILLANCE,
                contents: contents,
                config: {
                    systemInstruction: systemInstruction,
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            flood_level: { type: Type.STRING },
                            structural_damage: { type: Type.STRING },
                            people_count_estimate: { type: Type.NUMBER },
                            reasoning_trace: { type: Type.STRING },
                            display_reasoning: {
                                type: Type.ARRAY,
                                items: { type: Type.STRING },
                                description: "3 short telegraphic bullet points for HUD. Max 10 words each."
                            },
                            extracted_address: { type: Type.STRING, description: "Identified visual landmark address or null." },
                            extracted_lat: { type: Type.NUMBER },
                            extracted_lng: { type: Type.NUMBER },
                            category: { type: Type.STRING },
                            people_safety: { type: Type.STRING },
                            requires_logistics: { type: Type.BOOLEAN },
                            suggested_asset_type: { type: Type.STRING },
                            location: {
                                type: Type.OBJECT,
                                properties: {
                                    lat: { type: Type.NUMBER },
                                    lng: { type: Type.NUMBER },
                                    address: { type: Type.STRING }
                                }
                            },
                            location_source: { type: Type.STRING, enum: ["VISUAL_LANDMARK", "UNKNOWN"] },
                            is_authentic: { type: Type.BOOLEAN },
                            priority: { type: Type.STRING, enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] }
                        },
                        required: ["flood_level", "structural_damage", "reasoning_trace", "display_reasoning", "category", "requires_logistics", "is_authentic", "priority"],
                    },
                    tools: [{ googleSearch: {} }],
                    thinkingConfig: {
                        includeThoughts: true,
                        thinkingLevel: ThinkingLevel.HIGH
                    }
                },
            });

            // Helper for cinematic typing effect
            const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

            let fullText = "";
            let collectedThoughts = "";

            for await (const chunk of resultStream) {
                const parts = chunk.candidates?.[0]?.content?.parts || [];
                for (const part of parts) {
                    if (part.thought) {
                        collectedThoughts += part.text;
                        if (onThought && part.text) {
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

            if (!fullText || !fullText.trim()) {
                console.warn(`[SURVEILLANCE] Empty response from Gemini (Attempt ${attempt}).`);
                if (attempt < MAX_RETRIES) {
                    await new Promise(r => setTimeout(r, 2000 * attempt)); // Backoff
                    continue; // Retry
                }
                throw new Error("Empty response from Gemini (Video Analysis Failed)");
            }

            console.log(`[SURVEILLANCE] Raw text: ${fullText.substring(0, 200)}...`);

            let result;
            try {
                result = extractAndParseJSON(fullText);
            } catch (e: any) {
                console.error(`[SURVEILLANCE] JSON Parsing failed:`, e.message);
                if (attempt < MAX_RETRIES) continue; // Retry on malformed JSON
                throw new Error(`Failed to parse surveillance response: ${e.message}`);
            }

            // Store raw thoughts in custom field
            (result as any).raw_thoughts = collectedThoughts.trim() || result.reasoning_trace;

            console.log(`[SURVEILLANCE] Result for ${incident.id}: Flood ${result.flood_level}, Damage: ${result.structural_damage}`);

            // Primary source: AI determined priority
            let calculatedPriority = (result.priority || "LOW").toUpperCase();

            // Safety override: If AI flagged as fake, force LOW
            if (result.is_authentic === false) {
                console.log(`[SURVEILLANCE] 🛡️ AUTHENTICITY CHECK FAILED. Downgrading to LOW.`);
                calculatedPriority = "LOW";
            }

            // Secondary verification: Human Factor
            if (result.is_authentic !== false) {
                const peopleCount = result.people_count_estimate || 0;
                const safety = (result.people_safety || "").toLowerCase();

                if (peopleCount > 0) {
                    if (safety.includes("danger") || safety.includes("trapped") || safety.includes("injured") || safety.includes("critical")) {
                        calculatedPriority = "CRITICAL";
                    } else if (calculatedPriority === "LOW") {
                        calculatedPriority = "MEDIUM";
                        result.requires_logistics = true;
                        result.suggested_asset_type = "RECON_DRONE";
                    }
                }
            }

            console.log(`[SURVEILLANCE] Assigned Priority: ${calculatedPriority}`);
            console.log(`[SURVEILLANCE] ========================================`);

            const responseObj: Partial<Incident> = {
                flood_level: result.flood_level,
                structural_damage: result.structural_damage,
                reasoning_trace: result.reasoning_trace,
                display_reasoning: result.display_reasoning || [], // HUD-ready bullet points
                category: result.category || "Surveillance Alert",
                priority: calculatedPriority as any,
                status: "TRIAGED",
                requires_logistics: result.requires_logistics,
                suggested_asset_type: result.suggested_asset_type,
                people_safety: result.people_safety,
                location_source: result.location_source
            };

            if (result.extracted_address && result.extracted_lat && result.extracted_lng) {
                console.log(`[SURVEILLANCE] 📍 VISUAL FORENSICS SUCCESS: Found ${result.extracted_address}`);
                responseObj.location = {
                    lat: result.extracted_lat,
                    lng: result.extracted_lng,
                    address: result.extracted_address
                };
            }

            return responseObj;

        } catch (error: any) {
            console.error(`[SURVEILLANCE] Error analyzing frame (Attempt ${attempt}):`, error.message);
            lastError = error;
            if (attempt < MAX_RETRIES) {
                await new Promise(r => setTimeout(r, 2000 * attempt));
            }
        }
    }

    // FINAL FALLBACK after retries fail
    console.error(`[SURVEILLANCE] All attempts failed.`);
    return {
        flood_level: "Unknown",
        structural_damage: `Analysis Failed: ${lastError?.message || "Unknown error"}`,
        reasoning_trace: `Error: ${lastError?.message}. Video could not be processed.`
    };
}
