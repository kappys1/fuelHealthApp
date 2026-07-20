export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Mutations may be replayed when the request never reached a usable response.
 * Validation/auth errors stay visible and are not queued indefinitely.
 */
export function isRetriableRequestError(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.status === 408 || error.status === 425 || error.status === 429 || error.status >= 500;
  }

  if (error && typeof error === "object" && "name" in error) {
    if (error.name === "TypeError") return true;
    if (error.name === "AbortError") return false;
  }

  const message = error instanceof Error ? error.message.trim() : "";
  return /^(failed to fetch|fetch failed|load failed|network ?error)/i.test(message);
}
