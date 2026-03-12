/**
 * Pure URL utility functions.
 * No side effects. No external calls. Deterministic input → output.
 */

/**
 * Validates that a string is a well-formed absolute HTTP/HTTPS URL.
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  }
  catch {
    return false;
  }
}

/**
 * Extracts the hostname from a URL, stripping the www. prefix.
 * Returns an empty string if parsing fails.
 */
export function extractHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  }
  catch {
    return "";
  }
}

/**
 * Normalises a base URL: ensures trailing slash is removed,
 * protocol is preserved, and the URL is lowercased.
 */
export function normaliseBaseUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    return `${parsed.protocol}//${parsed.hostname}${parsed.pathname}`.replace(/\/$/, "");
  }
  catch {
    return rawUrl.trim().replace(/\/$/, "");
  }
}

/**
 * Deduplicates an array of URL strings, preserving insertion order.
 */
export function deduplicateUrls(urls: string[]): string[] {
  return [...new Set(urls)];
}

/**
 * Filters a list of URLs, returning only those that are valid absolute HTTP/HTTPS URLs.
 */
export function filterValidUrls(urls: string[]): string[] {
  return urls.filter(isValidUrl);
}

/**
 * Splits a URL list into chunks of a given size for batch processing.
 */
export function chunkUrls(urls: string[], chunkSize: number): string[][] {
  const chunks: string[][] = [];
  for (let i = 0; i < urls.length; i += chunkSize) {
    chunks.push(urls.slice(i, i + chunkSize));
  }
  return chunks;
}
