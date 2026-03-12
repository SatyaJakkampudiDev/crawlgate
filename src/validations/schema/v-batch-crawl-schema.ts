import { z } from "zod";

export const batchCrawlSchema = z.object({
  urls: z
    .array(z.string().url("Each entry must be a valid URL"))
    .min(1, "At least one URL is required")
    .max(50, "Maximum 50 URLs per batch"),
  provider: z.enum(["bee", "ant", "firecrawl"]).optional(),
  concurrency: z.number().int().min(1).max(5).optional().default(1),
  waitMs: z.number().int().min(0).max(10_000).optional().default(3000),
  useBrowser: z.boolean().optional().default(true),
  maxRetries: z.number().int().min(0).max(5).optional().default(2),
  webhookUrl: z.string().url("Must be a valid webhook URL").optional(),
  metadata: z
    .record(z.unknown())
    .optional()
    .default({}),
});

export type BatchCrawlInput = z.infer<typeof batchCrawlSchema>;
