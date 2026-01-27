// Using stable model names with generous free tier
// gemini-2.5-flash-lite has higher rate limits than 2.5/3.x models
export const MODELS = {
    COORDINATOR: "gemini-2.5-flash-lite",  // Fast, low-latency
    TRIAGE: "gemini-2.5-flash-lite",       // Complex reasoning
    SURVEILLANCE: "gemini-2.5-flash-lite", // Vision capabilities  
    LOGISTICS: "gemini-2.5-flash-lite",    // Grounding support
    REASONING: "gemini-3-flash-preview", // Deep research/reporting
} as const;
