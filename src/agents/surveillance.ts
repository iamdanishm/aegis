"use server";

import { ai } from "@/lib/gemini-client";
import { MODELS } from "@/lib/constants";
import { type Incident } from "@/lib/types";
import { Type } from "@google/genai";
import fs from "fs";
import path from "path";
import { extractFrame } from "@/lib/video-utils";

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
    // ... (Keep existing file loading logic) ...
    // Note: I am not changing lines 42-65, so I will start the replacement from before the prompt construction

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

    const isImage = mimeType.startsWith("image/");
    const systemInstruction = `
    You are an AI Surveillance Officer. You are analyzing a drone video stream or image feed.

    ${isImage ? `
    AGENTIC VISION ENABLED:
    - You have the ability to WRITE and EXECUTE Python code to zoom in, crop, and inspect images.
    - If details (text, faces, license plates, small landmarks) are too small to see, you MUST use 'zoom' to inspect them.
    - Formulate a plan: Think -> Zoom/Crop -> Observe -> Result.
    - This is critical for VISUAL FORENSICS.
    ` : `
    NOTE: AGENTIC VISION (Zoom/Crop via Code) is currently RESTRICTED to still images. 
    For this VIDEO feed, focus on temporal analysis.
    
    IMPORTANT: If you see a potential CLUE (sign, landmark, text) that is too small or blurred to read:
    1. Set "needs_visual_forensics" to output TRUE.
    2. Continue with general analysis.
    The system will automatically extract a high-res frame and re-run the Agentic Vision for you.
    `}

    ANALYSIS TASKS:
    1. VISUAL FORENSICS (CRITICAL):
       - If coordinates are MISSING (0,0) or unknown, you MUST analyze the visual frame for LOCATION CLUES.
       - Look for: Street Signs, Landmarks, Business Names, License Plates, distinctive geography.
       ${isImage ? "- If a clue is found, use the AGENTIC VISION to zoom in and verify." : "- If a clue is small/blurred, request FORENSICS (needs_visual_forensics=true)."}
       - Use Google Search Grounding (if available) to find the final address after verification.
       - Output the inferred location in 'extracted_address', 'extracted_lat', 'extracted_lng'.
       - Set 'location_source' to "VISUAL_LANDMARK".
    
    2. Analyze the video frame/image for structural damage and flood levels.
    3. Determine the PRIORITY and CATEGORY.
    4. Provide a REASONING TRACE.
    5. LOGISTICS HANDOFF: Decide if this incident requires physical asset deployment.
    `;

    const userPrompt = `
    TACTICAL CONTEXT:
    ID: ${incident.id}
    Location: ${incident.location.address}
    
    Analyze the attached media feed.
    `;

    try {
        console.log(`[SURVEILLANCE] Sending request to Gemini (Stream)...`);

        const contents: any[] = [
            { text: userPrompt },
            {
                inlineData: {
                    mimeType: mimeType,
                    data: mediaData
                }
            }
        ];

        const resultStream = await ai.models.generateContentStream({
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
                        extracted_address: { type: Type.STRING, description: "Identified visual landmark address or null." },
                        extracted_lat: { type: Type.NUMBER },
                        extracted_lng: { type: Type.NUMBER },
                        category: { type: Type.STRING },
                        people_safety: { type: Type.STRING },
                        requires_logistics: { type: Type.BOOLEAN },
                        suggested_asset_type: { type: Type.STRING },
                        location_source: { type: Type.STRING, enum: ["VISUAL_LANDMARK", "UNKNOWN"] },
                        needs_visual_forensics: { type: Type.BOOLEAN, description: "Set to true if a detailed zoom is needed on a video frame." }
                    },
                    required: ["flood_level", "structural_damage", "reasoning_trace", "category", "requires_logistics"],
                },
                tools: isImage ? [
                    { codeExecution: {} }
                ] : [],
                thinkingConfig: {
                    includeThoughts: true,
                    thinkingLevel: "HIGH" as any
                }
            },
        });

        // Helper for cinematic typing effect
        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

        let fullText = "";
        let collectedThoughts = "";

        if (!isImage && onThought) {
            onThought("[SYSTEM] Agentic Vision (Zoom/Crop) is currently restricted to still images. Performing high-fidelity video analysis...\n");
        }

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
                } else if (part.executableCode) {
                    const codeMsg = `\n[AGENTIC VISION] Formulating Plan: ${part.executableCode.language}\n\`\`\`python\n${part.executableCode.code}\n\`\`\`\n`;
                    collectedThoughts += codeMsg;
                    if (onThought) onThought(codeMsg);
                    console.log(`[SURVEILLANCE] Generated Code:`, part.executableCode.code);
                } else if (part.codeExecutionResult) {
                    const resMsg = `\n[AGENTIC VISION] Execution Result: ${part.codeExecutionResult.outcome}\nOutput: ${part.codeExecutionResult.output}\n`;
                    collectedThoughts += resMsg;
                    if (onThought) onThought(resMsg);
                    console.log(`[SURVEILLANCE] Execution Output:`, part.codeExecutionResult.output);
                } else if (part.text) {
                    fullText += part.text;
                }
            }
        }

        console.log(`[SURVEILLANCE] Raw text: ${fullText.substring(0, 200)}...`);

        let result;
        try {
            const jsonMatch = fullText.match(/\{[\s\S]*\}/);
            const jsonStr = jsonMatch ? jsonMatch[0] : fullText;
            result = JSON.parse(jsonStr);
        } catch (e) {
            console.error(`[SURVEILLANCE] JSON Parsing failed:`, e);
            throw new Error("Failed to parse surveillance response");
        }

        // Store raw thoughts in custom field if needed (though mostly for streaming)
        (result as any).raw_thoughts = collectedThoughts.trim() || result.reasoning_trace;

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

        // =================================================================================
        // MULTI-PASS FORENSIC LOOP (For Videos)
        // =================================================================================
        if (result.needs_visual_forensics && !isImage && incident.raw_input.startsWith("/")) {
            console.log(`[SURVEILLANCE] 🔍 Forensic Zoom Requested! Initiating Pass 2...`);

            if (onThought) onThought("\n[SYSTEM] Detail Obscured. Auto-extracting High-Res Frame for Forensic Zoom...\n");

            try {
                // 1. Extract Frame
                const videoPath = path.join(process.cwd(), "public", incident.raw_input);
                const framesDir = path.join(process.cwd(), "public", "forensics");
                const framePath = await extractFrame(videoPath, framesDir, "00:00:02"); // Sample 2s in for stability

                // 2. Create Forensic Incident (Recursive Call)
                // We map the absolute path to a relative public path for the recursion to handle it correctly
                // or we can pass base64 directly? 
                // The current logic at top of file handles absolute paths if they are in public? 
                // Let's use the relative path logic since lines 58-60 use path.join(cwd, public, raw_input)

                const relativeFramePath = "/forensics/" + path.basename(framePath);

                const forensicIncident: Incident = {
                    ...incident,
                    id: incident.id + "-FORENSIC",
                    raw_input: relativeFramePath,
                    type: "IMAGE" // Force Image type to enable Agentic Vision
                };

                console.log(`[SURVEILLANCE] Analyzing forensic frame: ${relativeFramePath}`);

                // 3. Recursive Call (Pass 2)
                const forensicResult = await analyzeSurveillance(forensicIncident, onThought);

                // 4. Merge Results
                if (forensicResult.reasoning_trace) {
                    responseObj.reasoning_trace += `\n\n=== FORENSIC ANALYSIS ===\n${forensicResult.reasoning_trace}`;
                }

                // Override location if forensics found a better one
                if (forensicResult.location) {
                    console.log(`[SURVEILLANCE] 🎯 Updating location from forensic pass: ${forensicResult.location.address}`);
                    responseObj.location = forensicResult.location;
                    responseObj.location_source = "VISUAL_LANDMARK";

                    // Also update extracted fields
                    result.extracted_address = forensicResult.location.address;
                }

                console.log(`[SURVEILLANCE] Forensic Pass Complete.`);

            } catch (err) {
                console.error(`[SURVEILLANCE] Forensic Pass Failed:`, err);
                if (onThought) onThought(`\n[SYSTEM] Forensic extraction failed: ${err}\n`);
            }
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
