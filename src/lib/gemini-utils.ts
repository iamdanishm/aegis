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
