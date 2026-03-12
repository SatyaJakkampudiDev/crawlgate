import type { CrawlMetadata, CrawlResult, CrawlStatus } from "./crawl-types.js";

export interface WebhookPayload {
  jobId: string;
  status: CrawlStatus;
  results: CrawlResult[];
  successCount: number;
  failedCount: number;
  metadata: CrawlMetadata;
  triggeredAt: string;
  completedAt: string;
  signature: string;
}

export interface WebhookDeliveryOptions {
  webhookUrl: string;
  payload: WebhookPayload;
  secret: string;
  maxRetries: number;
  retryBaseMs: number;
}

export interface WebhookDeliveryResult {
  success: boolean;
  attempts: number;
  finalStatusCode?: number;
  error?: string;
}
