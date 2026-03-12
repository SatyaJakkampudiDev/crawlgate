import { z } from "zod";

export const pdfCrawlSchema = z.object({
  url: z.string().url("Must be a valid URL pointing to a PDF file"),
  metadata: z
    .record(z.unknown())
    .optional()
    .default({}),
});

export type PdfCrawlInput = z.infer<typeof pdfCrawlSchema>;
