import type { ZodTypeAny } from "zod";

import UnprocessableEntityException from "../exceptions/unprocessable-entity-exception.js";
import { batchCrawlSchema } from "./schema/v-batch-crawl-schema.js";
import { domainMapSchema, domainCrawlSchema } from "./schema/v-domain-map-schema.js";
import { pdfCrawlSchema } from "./schema/v-pdf-crawl-schema.js";
import { singleCrawlSchema } from "./schema/v-single-crawl-schema.js";

// ── Activity type ──────────────────────────────────────────────────────────────

export type CrawlActivity
  = | "single-crawl"
    | "batch-crawl"
    | "domain-map"
    | "domain-crawl"
    | "pdf-crawl";

// ── Validate ──────────────────────────────────────────────────────────────────

export async function validateRequest<R>(
  actionType: CrawlActivity,
  reqData: unknown,
  errorMessage: string,
): Promise<R> {
  let schema: ZodTypeAny | undefined;

  switch (actionType) {
    case "single-crawl":
      schema = singleCrawlSchema;
      break;
    case "batch-crawl":
      schema = batchCrawlSchema;
      break;
    case "domain-map":
      schema = domainMapSchema;
      break;
    case "domain-crawl":
      schema = domainCrawlSchema;
      break;
    case "pdf-crawl":
      schema = pdfCrawlSchema;
      break;
  }

  if (!schema) {
    throw new Error(`No schema registered for action type: ${actionType}`);
  }

  const validation = await schema.safeParseAsync(reqData);

  if (!validation.success) {
    throw UnprocessableEntityException(errorMessage, getValidationErrors(validation.error.errors));
  }

  return validation.data as R;
}

// ── Field error formatter ──────────────────────────────────────────────────────

function getValidationErrors(issues: { path: (string | number)[]; message: string }[]): Record<string, string[]> {
  const errors: Record<string, string[]> = {};

  for (const issue of issues) {
    const field = issue.path.length > 0 ? String(issue.path[issue.path.length - 1]) : "root";
    if (!errors[field])
      errors[field] = [];
    errors[field].push(issue.message);
  }

  return errors;
}
