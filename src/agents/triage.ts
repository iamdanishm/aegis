"use server";

import { ai } from "@/lib/gemini-client";
import { MODELS } from "@/lib/constants";
import { type Incident } from "@/lib/types";
import { Type } from "@google/genai";
import fs from "fs";
import path from "path";

import { MOCK_RESPONSES } from "@/simulation/mock_responses";

// The Triage Agent analyzes distress calls for priority.
export async function triageIncident(incident: Incident): Promise<Partial<Incident>> {
    // SIMULATION FALLBACK: If no API key, use mock data
    if (!process.env.GEMINI_API_KEY) {
        console.log(`[TRIAGE] [SIMULATION MODE] Returning mock response for ${incident.id}`);

        // MOCK TRANSLATION LOGIC
        if (incident.raw_input.includes("Ayuda")) {
            return {
                id: incident.id,
                priority: "CRITICAL",
                category: "FLOOD",
                reasoning_trace: "Basement flooding, elderly trapped (Translated from Spanish)",
                detected_language: "Spanish",
                status: "TRIAGED",
                thought_signature: `MOCK-SIG-ES-${Date.now()}`
            };
        }

        if (incident.raw_input.includes("Building gir")) {
            return {
                id: incident.id,
                priority: "CRITICAL",
                category: "COLLAPSE",
                reasoning_trace: "Building collapse, multiple people trapped (Translated from Hindi)",
                detected_language: "Hindi",
                status: "TRIAGED",
                thought_signature: `MOCK-SIG-HI-${Date.now()}`
            };
        }

        const mock = MOCK_RESPONSES[incident.id];
        if (mock) {
            return {
                ...mock,
                status: "TRIAGED",
                thought_signature: `MOCK-SIG-${incident.id}-${Date.now()}`
            };
        }
        // Generic fallback if specific ID not found in mocks
        return {
            priority: "MEDIUM",
            category: "General",
            reasoning_trace: "No specific mock data found. Defaulting to standard triage. [MOCK]",
            status: "TRIAGED",
            thought_signature: `MOCK-SIG-GENERIC-${Date.now()}`
        };
    }
    console.log(`[TRIAGE] ========================================`);
    console.log(`[TRIAGE] Analyzing incident ${incident.id}...`);
    console.log(`[TRIAGE] Using model: ${MODELS.TRIAGE}`);
    console.log(`[TRIAGE] Input type: ${incident.type}`);
    console.log(`[TRIAGE] Raw input: ${incident.raw_input.substring(0, 100)}...`);

    const prompt = `
    You are an AI Triage Officer.

        TASKS:
    1. Analyze the input(Audio / Text) for distress signals, specifically looking for mentions of PEOPLE, INJURIES, or TRAPPED individuals.
    2. LANGUAGE DETECTION: Detect the language of the input.
       - If it is NOT English, translate the summary / reasoning into English, but set the 'detected_language' field to the original language(e.g., 'Spanish').
       - If English, leave 'detected_language' as 'English'.
    3. Determine Priority(CRITICAL, HIGH, MEDIUM, LOW) and Category.
       - RULE: If there are people hurt, trapped, or in immediate danger -> Priority MUST be CRITICAL.
       - RULE: If there is mention of "children", "elderly", or "help" with structural failure -> Priority MUST be CRITICAL.
    4. EXTRACT LOCATION: If the user speaks or writes an address / location, extract it.
       - If a specific location is found, ESTIMATE its Latitude and Longitude(e.g., "123 Main St, New York" -> lat / lng).
       - If no location is mentioned, return null for location fields.
    5. Provide a reasoning trace that explicitly mentions the human factor if applicable.
       - Note: Specifically denote if translation occurred.
  `;

    try {
        console.log(`[TRIAGE] Sending request to Gemini...`);

        const contents: any[] = [{ text: prompt }];

        if (incident.type === "AUDIO" && incident.raw_input.startsWith("/")) {
            const filePath = path.join(process.cwd(), "public", incident.raw_input);
            if (fs.existsSync(filePath)) {
                const audioData = fs.readFileSync(filePath);
                contents.push({
                    inlineData: {
                        mimeType: "audio/mpeg",
                        data: audioData.toString("base64")
                    }
                });
                console.log(`[TRIAGE] Attached audio file: ${filePath} `);
            }
        }

        const response = await ai.models.generateContent({
            model: MODELS.TRIAGE,
            contents: contents,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        priority: { type: Type.STRING },
                        category: { type: Type.STRING },
                        reasoning_trace: { type: Type.STRING },
                        detected_language: { type: Type.STRING },
                        extracted_address: { type: Type.STRING, description: "The address explicitly mentioned in the input, or null." },
                        extracted_lat: { type: Type.NUMBER, description: "Estimated latitude of the extracted address, or null." },
                        extracted_lng: { type: Type.NUMBER, description: "Estimated longitude of the extracted address, or null." },
                    },
                    required: ["priority", "category", "reasoning_trace"],
                },
            },
        });

        console.log(`[TRIAGE] Response received successfully`);

        const result = JSON.parse(response.text || "{}");
        console.log(`[TRIAGE] Parsed result: `, result);

        // Generate a crypto-audit signature (simulation)
        const signature = `SIG - ${Date.now()} -${Math.random().toString(36).substring(7).toUpperCase()} `;

        const responseObj: Partial<Incident> = {
            priority: result.priority,
            category: result.category,
            reasoning_trace: result.reasoning_trace,
            detected_language: result.detected_language,
            thought_signature: signature,
            status: "TRIAGED",
        };

        // If location was extracted, update the incident's location
        if (result.extracted_address && result.extracted_lat && result.extracted_lng) {
            console.log(`[TRIAGE] LOCATION FOUND: ${result.extracted_address} (${result.extracted_lat}, ${result.extracted_lng})`);
            responseObj.location = {
                lat: result.extracted_lat,
                lng: result.extracted_lng,
                address: result.extracted_address
            };
        }

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
