import { GoogleGenAI } from "@google/genai";

if (!process.env.GEMINI_API_KEY) {
    throw new Error("Missing GEMINI_API_KEY environment variable");
}

export const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
});

// Using stable model names with generous free tier
// gemini-2.5-flash-lite has higher rate limits than 2.5/3.x models
export const MODELS = {
    COORDINATOR: "gemini-2.5-flash-lite",  // Fast, low-latency
    TRIAGE: "gemini-2.5-flash-lite",       // Complex reasoning
    SURVEILLANCE: "gemini-2.5-flash-lite", // Vision capabilities  
    LOGISTICS: "gemini-2.5-flash-lite",    // Grounding support
} as const;

console.log("[GEMINI-CLIENT] Initialized with models:", MODELS);
