"use server";

import { ai, generateThoughtSignature } from "@/lib/gemini-client";
import { MODELS } from "@/lib/constants";
import { type Incident } from "@/lib/types";
import { Type } from "@google/genai";
import fs from "fs";
import path from "path";


import { MOCK_RESPONSES } from "@/simulation/mock_responses";

/**
 * Generate a real SHA-256 cryptographic signature for audit trail.
 * Creates a hash of reasoning + priority + timestamp as "Chain of Custody" proof.
 */

export async function triageIncident(incident: Incident, onThought?: (thought: string) => void): Promise<Partial<Incident>> {
    // SIMULATION FALLBACK: If no API key, use mock data
    if (!process.env.GEMINI_API_KEY) {
        console.log(`[TRIAGE] [SIMULATION MODE] Returning mock response for ${incident.id}`);

        // MOCK TRANSLATION LOGIC
        if (incident.raw_input.includes("Ayuda")) {
            if (onThought) {
                const mockThoughts = ["Simulating thought: Detecting Spanish...", "Simulating thought: Identifying keywords 'Ayuda'...", "Simulating thought: Assigning CRITICAL priority for potential distress."];
                for (const t of mockThoughts) {
                    onThought(t + "\n");
                    await new Promise(r => setTimeout(r, 500)); // Fake delay
                }
            }
            return {
                id: incident.id,
                priority: "CRITICAL",
                category: "FLOOD",
                reasoning_trace: "Basement flooding, elderly trapped (Translated from Spanish)",
                detected_language: "Spanish",
                status: "TRIAGED",
                thought_signature: generateThoughtSignature("Basement flooding, elderly trapped (Translated from Spanish)", "CRITICAL", Date.now())
            };
        }

        if (incident.raw_input.includes("Building gir")) {
            if (onThought) {
                const mockThoughts = ["Simulating thought: Recognizing 'Building gir' as 'Building collapse'...", "Simulating thought: Identifying multiple people trapped...", "Simulating thought: Assigning CRITICAL priority."];
                for (const t of mockThoughts) {
                    onThought(t + "\n");
                    await new Promise(r => setTimeout(r, 500)); // Fake delay
                }
            }
            return {
                id: incident.id,
                priority: "CRITICAL",
                category: "COLLAPSE",
                reasoning_trace: "Building collapse, multiple people trapped (Translated from Hindi)",
                detected_language: "Hindi",
                status: "TRIAGED",
                thought_signature: generateThoughtSignature("Building collapse, multiple people trapped (Translated from Hindi)", "CRITICAL", Date.now())
            };
        }

        const mock = MOCK_RESPONSES[incident.id];
        if (mock) {
            return {
                ...mock,
                status: "TRIAGED",
                thought_signature: generateThoughtSignature(mock.reasoning_trace || "Mock triage", mock.priority || "MEDIUM", Date.now())
            };
        }
        // Generic fallback if specific ID not found in mocks
        return {
            priority: "MEDIUM",
            category: "General",
            reasoning_trace: "No specific mock data found. Defaulting to standard triage. [MOCK]",
            status: "TRIAGED",
            thought_signature: generateThoughtSignature("No specific mock data found. Defaulting to standard triage.", "MEDIUM", Date.now())
        };
    }
    console.log(`[TRIAGE] ========================================`);
    console.log(`[TRIAGE] Analyzing incident ${incident.id}...`);
    console.log(`[TRIAGE] Using model: ${MODELS.TRIAGE}`);
    console.log(`[TRIAGE] Input type: ${incident.type}`);
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
    
    6. REASONING TRACE: Concise summary starting with location methodology status.
    7. LOGISTICS HANDOFF: Decide if this incident requires physical asset deployment.
       - If "MANUAL_TRACE_REQUIRED", require logistics but note "Pending Trace".

    RESPONSE FORMAT (JSON):
    {
       "priority": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
       "category": "String",
       "reasoning_trace": "String (Step-by-step)",
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

    const userPrompt = `
    INCIDENT DATA:
    ID: ${incident.id}
    Type: ${incident.type}
    Signal Metadata: ${JSON.stringify(incident.signal_metadata || "NONE")}
    Raw Input: ${incident.raw_input.substring(0, 500)}...
    
    Analyze this signal and provide your assessment in JSON format.
    `;

    try {
        const contents: any[] = [{ text: userPrompt }];

        // Robust audio file loading with production fallback
        if (incident.type === "AUDIO" && incident.raw_input.startsWith("/")) {
            let audioData: string | Buffer = "";
            try {
                const publicPath = path.join(process.cwd(), "public");
                const filePath = path.join(publicPath, incident.raw_input);

                // Safety check for Vercel environments
                if (fs.existsSync(filePath)) {
                    audioData = fs.readFileSync(filePath).toString("base64");
                    contents.push({
                        inlineData: {
                            mimeType: "audio/mpeg",
                            data: audioData
                        }
                    });
                    console.log(`[TRIAGE] Attached audio file: ${filePath}`);
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

        const resultStream = await ai.models.generateContentStream({
            model: MODELS.TRIAGE,
            contents: contents,
            config: {
                systemInstruction: systemInstruction,
                thinkingConfig: {
                    includeThoughts: true,
                    thinkingLevel: "HIGH" as any
                },
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        priority: { type: Type.STRING },
                        category: { type: Type.STRING },
                        reasoning_trace: { type: Type.STRING },
                        detected_language: { type: Type.STRING },
                        extracted_address: { type: Type.STRING },
                        extracted_lat: { type: Type.NUMBER },
                        extracted_lng: { type: Type.NUMBER },
                        requires_logistics: { type: Type.BOOLEAN },
                        suggested_asset_type: { type: Type.STRING },
                        location_source: { type: Type.STRING, enum: ["SPOKEN", "VISUAL_LANDMARK", "SIGNAL_TRIANGULATION", "MANUAL_TRACE_REQUIRED", "UNKNOWN"] },
                        manual_trace_required: { type: Type.BOOLEAN }
                    },
                    required: ["priority", "category", "reasoning_trace", "location_source"],
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

        const rawText = fullText || "{}";
        console.log(`[TRIAGE] Raw text: \n${rawText.substring(0, 500)}...`);

        // Extracted thoughts are now in collectedThoughts variable
        let extractedThoughts = collectedThoughts;

        let result;
        try {
            // Robust JSON extraction: Find the first { and the last }
            const jsonMatch = rawText.match(/\{[\s\S]*\}/);
            const jsonStr = jsonMatch ? jsonMatch[0] : rawText;
            result = JSON.parse(jsonStr);
        } catch (parseError) {
            console.error("[TRIAGE] JSON Parse Failed. Raw text:", rawText);
            throw new Error("JSON Parse Failed: " + (parseError as any).message);
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
