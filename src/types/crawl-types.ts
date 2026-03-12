import type { ProviderName } from "./env-types.js";

export interface CrawlResult {
  url: string;
  hostname: string;
  markdown: string | null;
  statusCode: number;
  error?: string;
  provider: string;
  durationMs: number;
}

export interface FailedUrl {
  url: string;
  reason: string;
}

export interface CrawlMetadata {
  clientId?: string;
  tags?: string[];
  context?: string;
  [key: string]: unknown;
}

export interface BatchCrawlOptions {
  urls: string[];
  provider: ProviderName;
  concurrency: number;
  waitMs: number;
  useBrowser: boolean;
  maxRetries: number;
  metadata: CrawlMetadata;
}

export interface SingleCrawlOptions {
  url: string;
  provider: ProviderName;
  waitMs: number;
  useBrowser: boolean;
  maxRetries: number;
  metadata: CrawlMetadata;
}

export type CrawlStatus = "completed" | "partial" | "failed";

export interface BatchJobResponse {
  jobId: string;
  mode: "async" | "sync";
  status: string;
  urlCount: number;
  successCount: number | null;
  failedCount: number | null;
  results: CrawlResult[] | null;
}
