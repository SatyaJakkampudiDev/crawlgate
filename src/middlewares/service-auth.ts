import type { AppEnv } from "../types/env-types.js";
import { bearerAuth } from "hono/bearer-auth";
import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";

import { MSG_UNAUTHORIZED } from "../constants/crawl-messages.js";

/**
 * Service-to-service authentication.
 * Validates Authorization: Bearer <SERVICE_TOKEN> against the env binding.
 * Uses Hono's built-in bearerAuth — no manual header parsing needed.
 */
export const serviceAuth = createMiddleware<AppEnv>(async (c, next) => {
  const middleware = bearerAuth({
    verifyToken: async (token) => {
      const expected = c.env.SERVICE_TOKEN;
      if (!expected || expected.length === 0) {
        throw new HTTPException(500, { message: "[AUTH] SERVICE_TOKEN not configured" });
      }
      if (token !== expected) {
        throw new HTTPException(401, { message: `Unauthorized, contact support` });
      }
      return true; // token is valid
    },
    noAuthenticationHeaderMessage: MSG_UNAUTHORIZED,
    invalidAuthenticationHeaderMessage: MSG_UNAUTHORIZED,
    invalidTokenMessage: MSG_UNAUTHORIZED,
  });
  return middleware(c, next);
});
