import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

import type { AppEnv } from "../types/env-types.js";

// ── Response shape ────────────────────────────────────────────────────────────

interface ApiResponse<T> {
  success: boolean;
  message: string;
  requestId: string;
  data: T | null;
}

// ── Utility ───────────────────────────────────────────────────────────────────

/**
 * Returns a typed JSON response using the standard API envelope.
 * Pulls requestId automatically from `c.var.requestId`.
 */
export function sendResponse<T>(
  c: Context<AppEnv>,
  status: ContentfulStatusCode,
  message: string,
  data?: T,
): Response {
  const body: ApiResponse<T> = {
    success: status < 400,
    message,
    requestId: c.var.requestId,
    data: data ?? null,
  };

  return c.json(body, status);
}
