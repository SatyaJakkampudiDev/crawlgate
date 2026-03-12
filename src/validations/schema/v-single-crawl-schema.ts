import { z } from "zod";

export const singleCrawlSchema = z.object({
  url: z.string().url("Must be a valid URL"),
  provider: z.enum(["bee", "ant", "firecrawl"]).optional(),
  waitMs: z.number().int().min(0).max(10_000).optional(),
  useBrowser: z.boolean().optional().default(true),
  maxRetries: z.number().int().min(0).max(5).optional(),
  metadata: z
    .record(z.unknown())
    .optional()
    .default({}),
});

export type SingleCrawlInput = z.infer<typeof singleCrawlSchema>;
