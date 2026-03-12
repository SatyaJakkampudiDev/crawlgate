import { computeBackoffMs, isRetryableStatus } from "./error-mapping-helper.js";

interface RetryOptions<T> {
  fn: (attempt: number) => Promise<T>;
  maxRetries: number;
  baseBackoffMs: number;
  isRetryable: (result: T, attempt: number) => boolean;
  onRetry?: (attempt: number, delayMs: number) => void;
}

/**
 * Generic retry wrapper with exponential backoff.
 * Retries `fn` up to `maxRetries` times when `isRetryable` returns true.
 * Returns the last result (or throws on unrecoverable error).
 */
export async function withRetry<T>(options: RetryOptions<T>): Promise<T> {
  const { fn, maxRetries, baseBackoffMs, isRetryable, onRetry } = options;
  let lastResult: T | undefined;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    lastResult = await fn(attempt);

    if (!isRetryable(lastResult, attempt) || attempt > maxRetries) {
      return lastResult;
    }

    const delayMs = computeBackoffMs(attempt, baseBackoffMs);
    onRetry?.(attempt, delayMs);
    await sleep(delayMs);
  }

  return lastResult as T;
}

/**
 * Determines if an HTTP response warrants a retry.
 * Used by providers to decide whether to retry a crawl request.
 */
export function shouldRetryHttpStatus(statusCode: number, attempt: number, maxRetries: number): boolean {
  return isRetryableStatus(statusCode) && attempt <= maxRetries;
}

/**
 * Returns a promise that resolves after `ms` milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
