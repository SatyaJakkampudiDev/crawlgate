import type { Context } from "hono";

import type { AppEnv } from "../types/env-types.js";

import { MSG_HEALTH_OK } from "../constants/crawl-messages.js";
import { sendResponse } from "../utils/send-response.js";

export function checkHealth(c: Context<AppEnv>): Response {
  return sendResponse(c, 200, MSG_HEALTH_OK, {
    environment: c.env.ENVIRONMENT ?? "unknown",
    timestamp: new Date().toISOString(),
  });
}
