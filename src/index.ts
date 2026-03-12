import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { AppEnv } from "./types/env-types.js";
import { cors } from "hono/cors";

import { HTTPException } from "hono/http-exception";
import { isBaseException } from "./exceptions/base-exception.js";
import factory from "./factory.js";
import { requestId } from "./middlewares/request-id.js";
import crawlRouter from "./routes/crawl-router.js";
import { processQueueMessage } from "./services/queue-processor.js";

const app = factory.createApp();

app.use("*", cors());
app.use("*", requestId);

app.get("/", c => c.redirect("/v1/health", 302));
app.route("/v1", crawlRouter);

app.post("/webhook", async (c) => {
  const { body } = await c.req.json();
  console.warn(body)
  return c.json({ success: true });
});

app.onError((err, c) => {
  if (isBaseException(err)) {
    return c.json(
      {
        success: false,
        message: err.message,
        requestId: c.var.requestId,
        ...(err.errData !== undefined && { errors: err.errData }),
      },
      err.status as ContentfulStatusCode,
    );
  }

  if (err instanceof HTTPException) {
    return c.json(
      {
        success: false,
        message: err.message,
        requestId: c.var.requestId,
      },
      err.status,
    );
  }

  console.error("[WORKER] Unhandled error:", {
    message: err.message,
    requestId: c.var.requestId,
    stack: err.stack,
  });

  return c.json(
    {
      success: false,
      message: "Internal server error",
      requestId: c.var.requestId,
    },
    500,
  );
});

app.notFound((c) => {
  return c.json(
    {
      success: false,
      message: `Route not found: ${c.req.method} ${c.req.path}`,
      requestId: c.var.requestId,
    },
    404,
  );
});

// Worker export
export default {
  async fetch(request: Request, env: AppEnv["Bindings"], ctx: ExecutionContext): Promise<Response> {
    return app.fetch(request, env, ctx);
  },

  async queue(batch: MessageBatch<unknown>, env: AppEnv["Bindings"]): Promise<void> {
    console.warn("[QUEUE] Batch received", {
      queue: batch.queue,
      messageCount: batch.messages.length,
      timestamp: new Date().toISOString(),
    });

    // Process all messages in parallel — each handles its own ack/retry internally.
    // Promise.allSettled ensures one failing message never blocks the others.
    await Promise.allSettled(
      batch.messages.map(message => processQueueMessage(message, env)),
    );
  },
};
