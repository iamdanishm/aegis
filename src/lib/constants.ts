// MVP Upgrade: Using experimental/preview models for enhanced capabilities
// gemini-2.0-flash-thinking-exp for deep reasoning, gemini-2.0-flash-exp for speed
export const MODELS = {
    COORDINATOR: "gemini-3-flash-preview",        // Fast, low-latency routing
    TRIAGE: "gemini-3-pro-preview",    // Deep reasoning with thinking
    SURVEILLANCE: "gemini-3-flash-preview",       // Vision capabilities  
    LOGISTICS: "gemini-3-flash-preview",          // Grounding support
    REASONING: "gemini-3-pro-preview",        // Deep research/reporting
} as const;
