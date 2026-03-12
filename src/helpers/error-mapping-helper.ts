import { MSG_PROVIDER_CREDITS_EXHAUSTED, MSG_PROVIDER_RATE_LIMITED } from "../constants/crawl-messages.js";

/**
 * Maps an HTTP status code (and optional error object) to a human-readable failure reason.
 * Provider-agnostic — used by all crawling providers.
 */
export function mapHttpStatusToReason(statusCode: number, err?: unknown): string {
  switch (statusCode) {
    case 400:
      return "Bad request - invalid URL or parameters.";
    case 401:
      return MSG_PROVIDER_CREDITS_EXHAUSTED;
    case 403:
      return "Access denied - bot detection triggered or invalid API key.";
    case 404:
      return "Page not found - the URL does not exist.";
    case 407:
      return "Proxy authentication required - check proxy configuration.";
    case 408:
      return "Request timed out - the page took too long to respond.";
    case 409:
      return MSG_PROVIDER_RATE_LIMITED;
    case 410:
      return "Page permanently removed - the URL is no longer available.";
    case 413:
      return "Response too large - the page content exceeds the size limit.";
    case 429:
      return MSG_PROVIDER_RATE_LIMITED;
    case 500:
      return "Provider internal server error - retry later.";
    case 503:
      return "Provider temporarily unavailable - retry later.";
    default:
      return resolveMessageFromError(err);
  }
}

/**
 * Resolves a failure reason from a caught error object when no status code is available.
 */
function resolveMessageFromError(err: unknown): string {
  if (typeof err === "string")
    return err;
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes("insufficient credits") || msg.includes("no more credit"))
      return MSG_PROVIDER_CREDITS_EXHAUSTED;
    if (msg.includes("rate limit") || msg.includes("too many"))
      return MSG_PROVIDER_RATE_LIMITED;
    if (msg.includes("timeout") || msg.includes("timed out"))
      return "Request timed out.";
    return err.message;
  }
  return "Failed to crawl the URL.";
}

/**
 * Returns true if the given HTTP status code is retryable (transient error).
 */
export function isRetryableStatus(statusCode: number): boolean {
  return statusCode === 403 || statusCode === 408 || statusCode === 409 || statusCode === 429 || statusCode >= 500;
}

/**
 * Computes the exponential backoff delay in milliseconds for a given attempt.
 * attempt is 1-indexed. baseMs is the initial delay.
 */
export function computeBackoffMs(attempt: number, baseMs: number): number {
  return baseMs * 2 ** (attempt - 1);
}
