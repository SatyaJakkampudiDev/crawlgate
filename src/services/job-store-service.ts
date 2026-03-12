import type { FailedUrlDetail, JobRecord, JobStatus, JobType } from "../types/job-types.js";
import type { CrawlMetadata, CrawlResult } from "../types/crawl-types.js";

//  Constants

// 7 days in seconds — jobs auto-expire from KV after this
const JOB_TTL_SECONDS = 60 * 60 * 24 * 7;

function jobKey(jobId: string): string {
  return `job:${jobId}`;
}

// Write

/**
 * Writes a new job record to KV when a job is first enqueued.
 * Status starts as "queued".
 */
export async function createJobRecord(
  kv: KVNamespace,
  options: {
    jobId: string;
    type: JobType;
    provider: string;
    triggeredAt: string;
    urlCount: number;
    domain?: string;
    webhookUrl?: string;
    metadata: CrawlMetadata;
  },
): Promise<void> {
  const record: JobRecord = {
    jobId: options.jobId,
    type: options.type,
    status: "queued",
    provider: options.provider,
    triggeredAt: options.triggeredAt,
    completedAt: null,
    urlCount: options.urlCount,
    successCount: null,
    failedCount: null,
    failedUrls: [],
    ...(options.domain !== undefined && { domain: options.domain }),
    ...(options.webhookUrl !== undefined && { webhookUrl: options.webhookUrl }),
    metadata: options.metadata,
    error: null,
  };

  await kv.put(jobKey(options.jobId), JSON.stringify(record), {
    expirationTtl: JOB_TTL_SECONDS,
  });
}

/**
 * Updates an existing job record's status and completion stats.
 * Called by the queue processor at key lifecycle points.
 */
export async function updateJobRecord(
  kv: KVNamespace,
  jobId: string,
  updates: {
    status: JobStatus;
    completedAt?: string;
    successCount?: number;
    failedCount?: number;
    failedUrls?: FailedUrlDetail[];
    error?: string;
  },
): Promise<void> {
  const existing = await readJobRecord(kv, jobId);
  if (existing === null) {
    console.warn("[JOB STORE] Cannot update — job not found in KV", { jobId });
    return;
  }

  const updated: JobRecord = {
    ...existing,
    status: updates.status,
    completedAt: updates.completedAt ?? existing.completedAt,
    successCount: updates.successCount ?? existing.successCount,
    failedCount: updates.failedCount ?? existing.failedCount,
    failedUrls: updates.failedUrls ?? existing.failedUrls,
    error: updates.error ?? existing.error,
  };

  await kv.put(jobKey(jobId), JSON.stringify(updated), {
    expirationTtl: JOB_TTL_SECONDS,
  });
}

// Read

/**
 * Reads a job record from KV by jobId.
 * Returns null if the job does not exist or has expired.
 */
export async function readJobRecord(kv: KVNamespace, jobId: string): Promise<JobRecord | null> {
  const raw = await kv.get(jobKey(jobId));
  if (raw === null)
    return null;

  try {
    return JSON.parse(raw) as JobRecord;
  }
  catch {
    console.error("[JOB STORE] Failed to parse job record", { jobId });
    return null;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Extracts failed URL details from a batch of crawl results.
 * Only includes URLs where markdown is null or error is present.
 */
export function extractFailedUrls(results: CrawlResult[]): FailedUrlDetail[] {
  return results
    .filter(r => r.markdown === null || r.error !== undefined)
    .map(r => ({
      url: r.url,
      statusCode: r.statusCode,
      error: r.error ?? "Failed to crawl the URL.",
      provider: r.provider,
      durationMs: r.durationMs,
    }));
}
