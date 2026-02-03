import { GoogleGenAI } from "@google/genai";
import crypto from "crypto";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.warn("[GEMINI-CLIENT] Warning: GEMINI_API_KEY environment variable is missing. The system will run in TEST MODE with mocked AI responses.");
}

const globalForAi = globalThis as unknown as { gemini: GoogleGenAI };

let aiInstance: GoogleGenAI;

if (globalForAi.gemini) {
    console.log("[GEMINI-CLIENT] Reusing existing Gemini client instance ♻️");
    aiInstance = globalForAi.gemini;
} else {
    console.log("[GEMINI-CLIENT] Initializing NEW Gemini client instance 🚀");
    aiInstance = new GoogleGenAI({
        apiKey: apiKey || "dummy-key-for-test",
    });
    // In development, save the instance to globalThis to prevent re-initialization on hot reload
    if (process.env.NODE_ENV !== "production") {
        globalForAi.gemini = aiInstance;
    }
}

export const ai = aiInstance;

import { MODELS } from "@/lib/constants";

if (!globalForAi.gemini) {
    console.log("[GEMINI-CLIENT] Initialized with models:", MODELS);
}

/**
 * Generates a cryptographic thought signature for audit trail integrity.
 * Uses HMAC-SHA256 to create a verifiable hash of the AI's reasoning process.
 * This serves as "Chain of Custody" proof that the reasoning wasn't tampered with.
 */
export function generateThoughtSignature(reasoning: string, priority: string = "UNKNOWN", timestamp: number = Date.now()): string {
    const secret = process.env.SECRET_KEY || "dev-secret-do-not-use-in-prod";
    const data = `${reasoning}|${priority}|${timestamp}`;
    const hmac = crypto.createHmac("sha256", secret).update(data).digest("hex");
    return `HMAC:${hmac.substring(0, 16)}`;
}
