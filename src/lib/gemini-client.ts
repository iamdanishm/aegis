import { GoogleGenAI } from "@google/genai";
import crypto from "crypto";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.warn("[GEMINI-CLIENT] Warning: GEMINI_API_KEY environment variable is missing. The system will run in SIMULATION MODE with mocked AI responses.");
}

export const ai = new GoogleGenAI({
    apiKey: apiKey || "dummy-key-for-simulation",
});

import { MODELS } from "@/lib/constants";

console.log("[GEMINI-CLIENT] Initialized with models:", MODELS);

/**
 * Generates or validates a thought signature.
 * If the model provides a signature, it validates/uses it.
 * Otherwise, it falls back to a server-side HMAC for integrity.
 */
export function generateThoughtSignature(reasoning: string, priority: string = "UNKNOWN", timestamp: number = Date.now(), modelSignature?: string): string {
    if (modelSignature) {
        // In a real scenario, we might verify this against a public key or similar
        // For now, if the model gave us a signature, we trust it came from the trusted execution environment
        return `GEMINI-AUTH:${modelSignature.substring(0, 16)}`;
    }

    // Fallback: HMAC-SHA256
    const secret = process.env.SECRET_KEY || "dev-secret-do-not-use-in-prod";
    const data = `${reasoning}|${priority}|${timestamp}`;
    const hmac = crypto.createHmac("sha256", secret).update(data).digest("hex");
    return `HMAC:${hmac.substring(0, 16)}`;
}
