import type { AppEnv } from "../types/env-types.js";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import { timeout } from "hono/timeout";

import { checkHealth } from "../handlers/health-handler.js";
import { handleGetJob } from "../handlers/job-handler.js";
import {
  handleBatchCrawl,
  handleDomainMap,
  handleDomainCrawl,
  handlePdfCrawl,
  handleSingleCrawl,
} from "../handlers/crawl-handler.js";

import { serviceAuth } from "../middlewares/service-auth.js";

const crawlRouter = new Hono<AppEnv>();

//  Health (public — no auth)
crawlRouter.get("/health", checkHealth);

//  Single URL crawl
crawlRouter.post(
  "/url",
  serviceAuth,
  timeout(25_000, () => new HTTPException(408, { message: "Crawl request timed out" })),
  handleSingleCrawl,
);

//  Batch crawl
crawlRouter.post(
  "/batch",
  serviceAuth,
  timeout(25_000, () => new HTTPException(408, { message: "Batch crawl request timed out" })),
  handleBatchCrawl,
);

//  Domain URL discovery
crawlRouter.post(
  "/domain/map",
  serviceAuth,
  timeout(20_000, () => new HTTPException(408, { message: "Domain map request timed out" })),
  handleDomainMap,
);

//  Full domain crawl (always async + webhook)
crawlRouter.post(
  "/domain/crawl",
  serviceAuth,
  timeout(10_000, () => new HTTPException(408, { message: "Request timed out" })),
  handleDomainCrawl,
);

//  PDF crawl
crawlRouter.post(
  "/pdf",
  serviceAuth,
  timeout(60_000, () => new HTTPException(408, { message: "PDF crawl request timed out" })),
  handlePdfCrawl,
);

//  Job stats
crawlRouter.get(
  "/jobs/:jobId",
  serviceAuth,
  handleGetJob,
);

export default crawlRouter;
