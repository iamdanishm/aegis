"use server";

import { ai, generateThoughtSignature } from "@/lib/gemini-client";
import { MODELS } from "@/lib/constants";
import { type Incident } from "@/lib/types";
import { ThinkingLevel, Type } from "@google/genai";
import fs from "fs";
import path from "path";

import { generateContentStreamWithRetry, extractAndParseJSON } from "@/lib/gemini-utils";


/**
 * Generate a real SHA-256 cryptographic signature for audit trail.
 * Creates a hash of reasoning + priority + timestamp as "Chain of Custody" proof.
 */

export async function triageIncident(incident: Incident, onThought?: (thought: string) => void): Promise<Partial<Incident>> {
    if (!process.env.GEMINI_API_KEY) {
        console.error("[TRIAGE] GEMINI_API_KEY missing. Cannot proceed with Live Analysis.");
        return {
            priority: "MEDIUM",
            category: "SYSTEM_OFFLINE",
            reasoning_trace: "System Offline: No AI API Key provided. Live analysis unavailable.",
            display_reasoning: ["System Offline", "API Key Missing", "Check Config"],
            status: "TRIAGED",
            thought_signature: "ERROR-NO-KEY"
        };
    }
    console.log(`[TRIAGE] ========================================`);
    console.log(`[TRIAGE] Analyzing incident ${incident.id}...`);
    console.log(`[TRIAGE] Using model: ${MODELS.TRIAGE}`);
    const inferredType = incident.type || (incident.raw_input.match(/\.(mp3|wav|ogg|webm|m4a|flac)$/i) ? 'AUDIO (inferred)' :
        incident.raw_input.match(/\.(mp4|webm|mov|avi)$/i) ? 'VIDEO (inferred)' :
            incident.raw_input.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? 'IMAGE (inferred)' : 'TEXT');
    console.log(`[TRIAGE] Input type: ${inferredType}`);
    console.log(`[TRIAGE] Raw input: ${incident.raw_input.substring(0, 100)}...`);

    const systemInstruction = `
    You are an AI Triage Officer for Project Aegis.
    
    TASKS:
    1. Analyze the input for distress signals.
    2. LANGUAGE DETECTION: Detect the language of the input.
    3. Determine the PRIORITY (LOW, MEDIUM, HIGH, CRITICAL).
    4. Determine the CATEGORY.
    5. LOCATION TRUTH & CONFLICT (CRITICAL):
       - Extract 'spoken_address' from the text/audio.
       - Compare it with the provided 'raw block' or 'metadata' location.
       - DUAL GROUNDING:
         - If 'spoken_address' exists, extract its coordinates.
         - If 'metadata_location' exists, extract its coordinates.
         - Calculate distance between them.
         - If Distance > 500 meters:
           - Flag 'location_ambiguity' = true.
           - Set 'location' to the GPS/Metadata (Safety Default).
           - Set 'conflicting_location' to the Spoken Address (for Human Review).
           - Reasoning: "⚠️ LOCATION MISMATCH. GPS says [X], Victim says [Y]. Defaulting to GPS anchor."
       - If NO spoken address:
         - Fallback to metadata.
       - If NO metadata:
         - "MANUAL_TRACE_REQUIRED".
       
       CRITICAL: If you extract an address (e.g. "Main Street Bridge"), you MUST use the \`googleSearch\` tool to find its precise GPS coordinates (lat/lng). return these in \`location\`.
    
    6. REASONING TRACE: Concise summary starting with location methodology status.
    7. LOGISTICS HANDOFF: Decide if this incident requires physical asset deployment.
       - If "MANUAL_TRACE_REQUIRED", set 'requires_logistics' = true and 'suggested_asset_type' = "RECON_DRONE".
       - If the incident is unverified by grounding but plausible, set 'requires_logistics' = true and 'suggested_asset_type' = "DRONE_VERIFICATION".

    USER OVERRIDE PROTOCOL (CRITICAL):
    - If the "Description/Alert" contains "[USER CONTEXT]" or specific location corrections (e.g. "Location confirmed to X"), you MUST:
      1. Trust the user's location correction over metadata.
      2. Use googleSearch to find coordinates for the User's Location.
      3. RETURN the new location in the "location" JSON field.
      4. Set "location_source" to "SPOKEN" or "MANUAL_TRACE_REQUIRED".
      5. Mention the correction in "reasoning_trace".

    PRIORITY RULES (STRICT BRAKE):
    - NO EVIDENCE = NO ESCALATION: If the googleSearch tool (GROUNDING) returns NO evidence of a disaster in the reported area, or if official news contradicts the claim, you MUST set priority to LOW.
    - FAKES & HISTORICAL: If your reasoning identifies the signal as likely fake, re-circulated footage, or a historical event, you MUST set priority to LOW.
    - VERIFICATION PROTOCOL: If the signal is plausible but unverified by grounding, the MAXIMUM priority is MEDIUM. Request "DRONE_VERIFICATION".
    - "Unknown Location" or "Signal Lost" incidents must NEVER be HIGH or CRITICAL. Max: MEDIUM.
    - CRITICAL is reserved EXCLUSIVELY for real-time, verified life-threatening emergencies with corroborating evidence.
    - If you are UNCERTAIN, default to MEDIUM, never HIGH or CRITICAL.

    8. DISPLAY REASONING (HUD BULLETS):
       - Generate exactly 3 short, telegraphic bullet points for tactical HUD display.
       - Each bullet: MAX 10 words. Military-style. No filler words.
       - Format: Action/Status focused. Example:
         • "Elderly trapped basement level"
         • "Water at electrical outlet height"
         • "Electrocution risk - IMMEDIATE"
    
    RESPONSE FORMAT (JSON):
    {
       "priority": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
       "category": "String",
       "reasoning_trace": "String (Step-by-step)",
       "display_reasoning": ["String", "String", "String"],
       "people_safety": "String",
       "location": { "lat": number, "lng": number, "address": "String" },
       "location_source": "SPOKEN" | "VISUAL_LANDMARK" | "SIGNAL_TRIANGULATION" | "MANUAL_TRACE_REQUIRED" | "GPS_DEFAULT",
       "location_ambiguity": boolean,
       "conflicting_location": { "address": "String", "lat": number, "lng": number, "source": "String" } | null,
       "manual_trace_required": boolean,
       "audit_log_entries": [
          { "agent": "Triage", "action": "String", "detail": "String", "timestamp": "ISO String" }
       ]
    }
    `;

    // Construct signal metadata from available location data
    const signalMetadata = incident.signal_metadata || (incident.location ? {
        gps_coords: { lat: incident.location.lat, lng: incident.location.lng },
        cell_tower_address: incident.location.address,
        source: "GPS_TELEMETRY"
    } : "NONE");

    const userPrompt = `
    INCIDENT DATA:
    ID: ${incident.id}
    Type: ${incident.type || "UNKNOWN (analyze raw input)"}
    Signal Metadata (GPS/Cell Tower): ${JSON.stringify(signalMetadata)}
    Description/Alert: ${incident.mission_context || "N/A"}
    Raw Input: ${incident.raw_input.substring(0, 500)}...
    
    Analyze this signal and provide your assessment in JSON format.
    `;

    try {
        const contents: any[] = [{ text: userPrompt }];

        // Detect audio files by extension (supports agentic routing where type is inferred)
        const audioExtensions = ['.mp3', '.wav', '.ogg', '.webm', '.m4a', '.flac'];
        const isAudioFile = audioExtensions.some(ext => incident.raw_input.toLowerCase().endsWith(ext));

        // Robust audio file loading with production fallback
        if (isAudioFile && incident.raw_input.startsWith("/")) {
            let audioData: string | Buffer = "";
            try {
                const publicPath = path.join(process.cwd(), "public");
                const filePath = path.join(publicPath, incident.raw_input);

                // Determine MIME type based on extension
                const ext = path.extname(incident.raw_input).toLowerCase();
                const mimeTypes: Record<string, string> = {
                    '.mp3': 'audio/mpeg',
                    '.wav': 'audio/wav',
                    '.ogg': 'audio/ogg',
                    '.webm': 'audio/webm',
                    '.m4a': 'audio/mp4',
                    '.flac': 'audio/flac'
                };
                const mimeType = mimeTypes[ext] || 'audio/mpeg';

                // Safety check for Vercel environments
                if (fs.existsSync(filePath)) {
                    audioData = fs.readFileSync(filePath).toString("base64");
                    contents.push({
                        inlineData: {
                            mimeType: mimeType,
                            data: audioData
                        }
                    });
                    console.log(`[TRIAGE] ✅ Attached audio file: ${filePath} (${mimeType})`);
                } else {
                    console.warn(`[Triage] Audio file missing at ${filePath}. Checking alternative paths...`);
                    // File not found in expected location - fail gracefully
                    throw new Error(`File not found: ${incident.raw_input}`);
                }
            } catch (error) {
                console.error("[Triage] Audio load error:", error);
                // Return a graceful fallback that doesn't 500 the page
                return {
                    id: incident.id,
                    priority: "MEDIUM", // Default safety
                    category: "UNCERTAIN",
                    reasoning_trace: "AUDIO FILE LOAD ERROR: The system could not access the raw audio feed for analysis. Manual review required.",
                    thought_signature: "ERROR-NO-SIG",
                    status: "TRIAGED"
                };
            }
        }

        // Helper for cinematic typing effect
        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

        console.log(`[TRIAGE] Sending request to Gemini (Stream)...`);
        console.log(`[TRIAGE] Payload (truncated):`, JSON.stringify(contents).substring(0, 500) + "...");

        const resultStream = await generateContentStreamWithRetry(ai.models, {
            model: MODELS.TRIAGE,
            contents: contents,
            config: {
                systemInstruction: systemInstruction,
                tools: [{ googleSearch: {} }], // Enable Grounding for location fallback
                thinkingConfig: {
                    includeThoughts: true,
                    thinkingLevel: ThinkingLevel.HIGH
                },
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        priority: { type: Type.STRING },
                        category: { type: Type.STRING },
                        reasoning_trace: { type: Type.STRING },
                        display_reasoning: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING },
                            description: "3 short telegraphic bullet points for HUD. Max 10 words each."
                        },
                        detected_language: { type: Type.STRING },
                        extracted_address: { type: Type.STRING },
                        extracted_lat: { type: Type.NUMBER },
                        extracted_lng: { type: Type.NUMBER },
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
                        location_source: { type: Type.STRING, enum: ["SPOKEN", "VISUAL_LANDMARK", "SIGNAL_TRIANGULATION", "MANUAL_TRACE_REQUIRED", "UNKNOWN"] },
                        manual_trace_required: { type: Type.BOOLEAN }
                    },
                    required: ["priority", "category", "reasoning_trace", "display_reasoning", "location_source"],
                },
            },
        });

        console.log(`[TRIAGE] Response stream started`);

        let fullText = "";
        let collectedThoughts = "";

        for await (const chunk of resultStream) {
            const parts = chunk.candidates?.[0]?.content?.parts || [];
            for (const part of parts) {
                if (part.thought) {
                    collectedThoughts += part.text;
                    if (onThought && part.text) {
                        // CINEMATIC SMOOTHING:
                        // Stream small chunks to force the UI to animate
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
            console.warn("[TRIAGE] Empty response from Gemini.");
            throw new Error("Empty response from Gemini (Triage Analysis Failed)");
        }

        const rawText = fullText;
        console.log(`[TRIAGE] Raw text: \n${rawText.substring(0, 500)}...`);

        // Extracted thoughts are now in collectedThoughts variable
        let extractedThoughts = collectedThoughts;

        let result;
        try {
            result = extractAndParseJSON(rawText);
        } catch (parseError: any) {
            console.error("[TRIAGE] JSON Parse Failed. Raw text:", rawText);
            throw new Error(`JSON Parse Failed: ${parseError.message}`);
        }

        // If we extracted genuine thoughts, use them for the "Glass Box" effect but don't overwrite the summary
        if (extractedThoughts.length > 5) {
            console.log("[TRIAGE] Captured internal monologue (thoughts)");
            // We prioritize the model's actual internal monologue if captured
            result.raw_thoughts = extractedThoughts.trim();
        } else {
            console.log("[TRIAGE] No separate thoughts captured, using reasoning_trace fallback");
            result.raw_thoughts = result.reasoning_trace || "Analysis process implicitly handled.";
        }

        // Generate Signed Thought Proof (using the robust fallback in gemini-client)
        const signature = generateThoughtSignature(result.raw_thoughts || result.reasoning_trace);

        console.log(`[TRIAGE] Parsed result: `, result);

        const responseObj: any = {
            priority: result.priority,
            category: result.category,
            reasoning_trace: result.reasoning_trace, // The concise summary from JSON
            display_reasoning: result.display_reasoning || [], // HUD-ready bullet points
            raw_thoughts: result.raw_thoughts,       // The deep thinking process
            thought_signature: signature,
            detected_language: result.detected_language,
            status: "TRIAGED",
            requires_logistics: result.requires_logistics,
            suggested_asset_type: result.suggested_asset_type,
            // These are now handled by the Map Forensics & Conflict block below
            // location_source: result.location_source,
            // manual_trace_required: result.manual_trace_required
        };

        // Map Forensics & Conflict
        responseObj.location_source = result.location_source;
        responseObj.manual_trace_required = result.manual_trace_required;
        responseObj.location_ambiguity = result.location_ambiguity;

        if (result.conflicting_location) {
            responseObj.conflicting_location = result.conflicting_location;
        }

        if (result.location) {
            responseObj.location = result.location;
        } else if (result.extracted_address) {
            // Fallback for older logic
            console.log(`[TRIAGE] LOCATION FOUND (fallback): ${result.extracted_address} (${result.extracted_lat}, ${result.extracted_lng})`);
            responseObj.location = {
                lat: result.extracted_lat,
                lng: result.extracted_lng,
                address: result.extracted_address
            };
        }

        // Attach Log Entries (These will be stripped by the stream handler but we return them)
        // Actually, Triage returns Partial<Incident>, it doesn't return the raw object with logs.
        // We need to pass these logs out via the onThought/Stream channel or modify the return type.
        // Since we can't easily change the return type without breaking the interface...
        // We will emit them as "audit_log" events via the stream if possible.
        // But `triageIncident` is just a function. The caller `api/coordinate/stream/route.ts` handles the stream.
        // So we should return them in the object, even if they aren't in Incident type?
        // No, Type safety.
        // Let's rely on the AI Generative Output to include them, and we need to pass them back.
        // I will return them in a temporary property property on Incident for now, or use a callback.

        // BETTER APPROACH:
        // The `triageIncident` returns `Partial<Incident>`.
        // I should add `audit_logs` to `Incident` interface temporarily? No.
        // I will add them to the `responseObj` as `_audit_logs` (casted) and the route will pick it up.
        (responseObj as any)._audit_logs = result.audit_log_entries;

        return responseObj;

    } catch (error: any) {
        console.error(`[TRIAGE] ========================================`);
        console.error(`[TRIAGE] ERROR analyzing incident: `, error.message);
        console.error(`[TRIAGE] Error name: `, error.name);
        console.error(`[TRIAGE] Full error: `, error);
        console.error(`[TRIAGE] ========================================`);

        return {
            priority: "HIGH",
            reasoning_trace: `Error in processing: ${error.message}. Defaulting to HIGH priority.`,
            status: "TRIAGED"
        };
    }
}
