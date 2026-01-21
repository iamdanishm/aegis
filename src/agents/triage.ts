"use server";

import { ai, MODELS } from "@/lib/gemini-client";
import { type Incident } from "@/lib/types";
import { Type } from "@google/genai";

// The Triage Agent analyzes distress calls for priority.
export async function triageIncident(incident: Incident): Promise<Partial<Incident>> {
    console.log(`[TRIAGE] ========================================`);
    console.log(`[TRIAGE] Analyzing incident ${incident.id}...`);
    console.log(`[TRIAGE] Using model: ${MODELS.TRIAGE}`);
    console.log(`[TRIAGE] Input type: ${incident.type}`);
    console.log(`[TRIAGE] Raw input: ${incident.raw_input.substring(0, 100)}...`);

    const prompt = `
    You are an AI Triage Officer for emergency response.
    Analyze the following distress signal.
    
    Input Type: ${incident.type}
    Input Data: ${incident.raw_input}
    
    Determine the Priority (CRITICAL, HIGH, MEDIUM, LOW) and the Category (Fire, Flood, Medical, etc.).
    Provide a detailed reasoning trace explaining WHY you assigned this priority.
    
    You MUST detect subtle cues (e.g., "water near outlets" -> Electrocution Risk).
  `;

    try {
        console.log(`[TRIAGE] Sending request to Gemini...`);

        const response = await ai.models.generateContent({
            model: MODELS.TRIAGE,
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        priority: { type: Type.STRING, description: "Priority level: CRITICAL, HIGH, MEDIUM, or LOW" },
                        category: { type: Type.STRING, description: "Category of emergency: Fire, Flood, Medical, etc." },
                        reasoning_trace: { type: Type.STRING, description: "Detailed reasoning for the priority assignment" },
                    },
                    required: ["priority", "category", "reasoning_trace"],
                },
            },
        });

        console.log(`[TRIAGE] Response received successfully`);
        console.log(`[TRIAGE] Raw response text: ${response.text?.substring(0, 200)}...`);

        const result = JSON.parse(response.text || "{}");
        console.log(`[TRIAGE] Parsed result:`, result);

        // Generate a crypto-audit signature (simulation)
        const signature = `SIG-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;
        console.log(`[TRIAGE] Thought Signature: ${signature}`);
        console.log(`[TRIAGE] ========================================`);

        return {
            priority: result.priority,
            category: result.category,
            reasoning_trace: result.reasoning_trace,
            thought_signature: signature,
            status: "TRIAGED",
        };

    } catch (error: any) {
        console.error(`[TRIAGE] ========================================`);
        console.error(`[TRIAGE] ERROR analyzing incident:`, error.message);
        console.error(`[TRIAGE] Error name:`, error.name);
        console.error(`[TRIAGE] Full error:`, error);
        console.error(`[TRIAGE] ========================================`);

        return {
            priority: "HIGH",
            reasoning_trace: `Error in processing: ${error.message}. Defaulting to HIGH priority.`,
            status: "TRIAGED"
        };
    }
}
