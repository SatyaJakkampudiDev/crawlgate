import type { CrawlMetadata, CrawlResult, CrawlStatus } from "../types/crawl-types.js";
import type { WebhookPayload } from "../types/webhook-types.js";

interface BuildWebhookPayloadOptions {
  jobId: string;
  status: CrawlStatus;
  results: CrawlResult[];
  metadata: CrawlMetadata;
  triggeredAt: string;
  completedAt: string;
  secret: string;
}

/**
 * Builds a signed WebhookPayload ready for delivery.
 * Signature is HMAC-SHA256 of `jobId + completedAt + status` using the shared secret.
 */
export async function buildWebhookPayload(options: BuildWebhookPayloadOptions): Promise<WebhookPayload> {
  const { jobId, status, results, metadata, triggeredAt, completedAt, secret } = options;

  const successCount = results.filter(r => r.markdown !== null && r.error === undefined).length;
  const failedCount = results.length - successCount;
  const signature = await computeHmacSignature(secret, `${jobId}.${completedAt}.${status}`);

  return {
    jobId,
    status,
    results,
    successCount,
    failedCount,
    metadata,
    triggeredAt,
    completedAt,
    signature,
  };
}

/**
 * Computes an HMAC-SHA256 signature for the given message using the provided secret.
 * Uses the Web Crypto API — available natively in Cloudflare Workers.
 */
export async function computeHmacSignature(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signatureBuffer = await crypto.subtle.sign("HMAC", keyMaterial, encoder.encode(message));
  return Array.from(new Uint8Array(signatureBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Verifies an inbound HMAC-SHA256 signature against an expected signature.
 * Uses constant-time comparison to prevent timing attacks.
 */
export async function verifyHmacSignature(
  secret: string,
  message: string,
  receivedSignature: string,
): Promise<boolean> {
  const expectedSignature = await computeHmacSignature(secret, message);
  return timingSafeEqual(expectedSignature, receivedSignature);
}

/**
 * Constant-time string comparison to prevent timing side-channel attacks.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length)
    return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
