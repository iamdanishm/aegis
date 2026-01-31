const RETRY_DELAYS = [1000, 3000, 8000, 15000]; // More aggressive exponential backoff: 1s, 3s, 8s, 15s

/**
 * Checks if an error is a retryable 503 or Overloaded error.
 */
function isRetryableError(error: any): boolean {
    const status = error.status || error.code;
    const message = error.message || "";

    return (
        status === 503 ||
        status === "UNAVAILABLE" ||
        message.includes("503") ||
        message.includes("Overloaded") ||
        message.includes("UNAVAILABLE") ||
        message.includes("overloaded")
    );
}

/**
 * Wraps model.generateContent with retry logic for 503 errors.
 */
export async function generateContentWithRetry(
    model: any,
    request: any
): Promise<any> {
    let lastError: any;

    for (let i = 0; i <= RETRY_DELAYS.length; i++) {
        try {
            return await model.generateContent(request);
        } catch (error: any) {
            lastError = error;
            if (isRetryableError(error)) {
                console.warn(`[GEMINI-UTILS] Service Unavailable/Overloaded. Retrying in ${RETRY_DELAYS[i] / 1000}s... (Attempt ${i + 1}/${RETRY_DELAYS.length})`);
                if (i < RETRY_DELAYS.length) {
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[i]));
                    continue;
                }
            }
            throw error; // Re-throw if not retryable or max retries reached
        }
    }
    throw lastError;
}

/**
 * Wraps model.generateContentStream with retry logic for 503 errors.
 */
export async function generateContentStreamWithRetry(
    model: any,
    request: any
): Promise<any> {
    let lastError: any;

    for (let i = 0; i <= RETRY_DELAYS.length; i++) {
        try {
            return await model.generateContentStream(request);
        } catch (error: any) {
            lastError = error;
            if (isRetryableError(error)) {
                console.warn(`[GEMINI-UTILS] Service Unavailable/Overloaded (Stream). Retrying in ${RETRY_DELAYS[i] / 1000}s... (Attempt ${i + 1}/${RETRY_DELAYS.length})`);
                if (i < RETRY_DELAYS.length) {
                    await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[i]));
                    continue;
                }
            }
            throw error;
        }
    }
    throw lastError;
}
/**
 * Robustly extracts and parses JSON from a string that may contain 
 * multiple JSON objects or surrounding text/markdown.
 */
export function extractAndParseJSON(text: string) {
    if (!text || !text.trim()) {
        throw new Error("Empty text provided for JSON parsing");
    }

    // 1. Try simple parse first
    try {
        return JSON.parse(text);
    } catch (e) {
        // Continue to more robust methods
    }

    // 2. Remove markdown code blocks and whitespace
    let cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    try {
        return JSON.parse(cleaned);
    } catch (e) {
        // Continue
    }

    // 3. Find all potential JSON objects using brace matching (handles nested objects)
    const jsonObjects: string[] = [];
    let braceCount = 0;
    let startPos = -1;

    for (let i = 0; i < cleaned.length; i++) {
        if (cleaned[i] === '{') {
            if (braceCount === 0) startPos = i;
            braceCount++;
        } else if (cleaned[i] === '}') {
            braceCount--;
            if (braceCount === 0 && startPos !== -1) {
                jsonObjects.push(cleaned.substring(startPos, i + 1));
                startPos = -1;
            }
        }
    }

    // 4. Try parsing each object, starting from the last one (often the most complete/final)
    for (let i = jsonObjects.length - 1; i >= 0; i--) {
        const candidate = jsonObjects[i];
        try {
            return JSON.parse(candidate);
        } catch (e) {
            // 5. Final attempt: sanitize control characters that break JSON.parse (like literal newlines)
            try {
                const sanitized = candidate.replace(/[\x00-\x1F]/g, (match) => {
                    if (match === '\n') return '\\n';
                    if (match === '\r') return '\\r';
                    if (match === '\t') return '\\t';
                    return '';
                });
                return JSON.parse(sanitized);
            } catch (innerE) {
                // Try next block
            }
        }
    }

    console.error("[GEMINI-UTILS] Failed to extract valid JSON from:", text);
    throw new Error("No valid JSON object found in response");
}
