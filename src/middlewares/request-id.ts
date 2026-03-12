import type { AppEnv } from "../types/env-types.js";
import { createMiddleware } from "hono/factory";

/**
 * Attaches a unique request ID to every request.
 * Accessible via c.var.requestId in all downstream handlers.
 */
export const requestId = createMiddleware<AppEnv>(async (c, next) => {
  const id = crypto.randomUUID();
  c.set("requestId", id);
  c.res.headers.set("X-Request-Id", id);
  await next();
});
