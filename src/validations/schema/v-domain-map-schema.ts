import { z } from "zod";

export const domainMapSchema = z.object({
  domain: z.string().url("Must be a valid domain URL"),
  maxUrls: z.number().int().min(1).max(500).optional().default(100),
  includeSubdomains: z.boolean().optional().default(false),
  metadata: z
    .record(z.unknown())
    .optional()
    .default({}),
});

export const domainCrawlSchema = z.object({
  domain: z.string().url("Must be a valid domain URL"),
  provider: z.enum(["bee", "ant", "firecrawl"]).optional(),
  maxUrls: z.number().int().min(1).max(500).optional().default(100),
  concurrency: z.number().int().min(1).max(5).optional().default(1),
  waitMs: z.number().int().min(0).max(10_000).optional().default(3000),
  useBrowser: z.boolean().optional().default(true),
  maxRetries: z.number().int().min(0).max(5).optional().default(2),
  webhookUrl: z.string().url("webhookUrl is required for domain crawl").min(1),
  metadata: z
    .record(z.unknown())
    .optional()
    .default({}),
});

export type DomainMapInput = z.infer<typeof domainMapSchema>;
export type DomainCrawlInput = z.infer<typeof domainCrawlSchema>;
