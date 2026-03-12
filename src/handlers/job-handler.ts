import type { Context } from "hono";
import type { AppEnv } from "../types/env-types.js";

import { HTTPException } from "hono/http-exception";
import { MSG_JOB_FOUND, MSG_JOB_NOT_FOUND } from "../constants/crawl-messages.js";
import { readJobRecord } from "../services/job-store-service.js";
import { sendResponse } from "../utils/send-response.js";

export async function handleGetJob(c: Context<AppEnv>): Promise<Response> {
  const jobId = c.req.param("jobId");

  if (jobId === undefined || jobId.trim().length === 0) {
    throw new HTTPException(400, { message: "jobId is required." });
  }

  const job = await readJobRecord(c.env.CRAWL_JOB_STORE, jobId);

  if (job === null) {
    return sendResponse(c, 404, MSG_JOB_NOT_FOUND);
  }

  return sendResponse(c, 200, MSG_JOB_FOUND, job);
}
