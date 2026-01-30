import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.warn("[GEMINI-CLIENT] Warning: GEMINI_API_KEY environment variable is missing. The system will run in SIMULATION MODE with mocked AI responses.");
}

export const ai = new GoogleGenAI({
    apiKey: apiKey || "dummy-key-for-simulation",
});

import { MODELS } from "@/lib/constants";

console.log("[GEMINI-CLIENT] Initialized with models:", MODELS);
