import type { ProviderName } from "./env-types.js";
import type { CrawlResult } from "./crawl-types.js";

export interface ProviderCrawlOptions {
  url: string;
  apiKey: string;
  baseUrl: string;
  waitMs: number;
  useBrowser: boolean;
  maxRetries: number;
  timeoutMs: number;
}

export interface ProviderBatchOptions {
  urls: string[];
  apiKey: string;
  baseUrl: string;
  waitMs: number;
  useBrowser: boolean;
  maxRetries: number;
  maxConcurrency: number;
}

export type CrawlUrlFn = (options: ProviderCrawlOptions) => Promise<CrawlResult>;

export interface ProviderAdapter {
  name: ProviderName;
  executionMode: "sync-parallel" | "native-batch-async";
  crawlUrl: CrawlUrlFn;
}
