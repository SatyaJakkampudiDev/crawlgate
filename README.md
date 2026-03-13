# crawlgate

[Open Crawlgate](https://dev-crawlgate.satyajakkampudidev.workers.dev)

A production-grade web crawling microservice built on **Cloudflare Workers** (edge, serverless). Abstracts three crawling providers behind a unified API, supports both synchronous and asynchronous job modes, and delivers results via signed webhooks.

Built as a personal infrastructure project to demonstrate scalable backend design on the Cloudflare developer platform.

**Tech:** TypeScript · Hono · Cloudflare Workers · Cloudflare Queues · Cloudflare KV · Zod · ScrapingAnt · ScrapingBee · Firecrawl

---

## Highlights

- **Provider abstraction** — single interface over ScrapingAnt, ScrapingBee, and Firecrawl; swap providers per-request via a `provider` field
- **Dual execution modes** — synchronous responses for small jobs; queue-backed async processing for large batches and full-domain crawls
- **Async job pipeline** — Cloudflare Queues consumer with phased execution (URL resolution → crawl → webhook), concurrency control via `p-limit`, and KV-backed job state with 7-day TTL
- **Signed webhook delivery** — HMAC-SHA256 payload signing with exponential backoff retries (configurable max attempts and base delay)
- **Schema validation** — Zod schemas per endpoint with structured field-level error responses
- **Bearer token auth** — lightweight service-token middleware protecting all non-health routes
- **Deployed on Cloudflare Workers** — live on `*.workers.dev`

---

## Table of Contents

- [Architecture](#architecture)
- [Providers](#providers)
- [Authentication](#authentication)
- [Endpoints](#endpoints)
- [Async Job Flow](#async-job-flow)
- [Webhook Delivery](#webhook-delivery)
- [Environment Setup](#environment-setup)
- [Deployment](#deployment)
- [Error Responses](#error-responses)

---

## Architecture

```
Client
  │
  ▼
Cloudflare Worker (Hono)
  ├── GET  /v1/health
  ├── POST /v1/url          → sync crawl
  ├── POST /v1/batch        → sync or async (via queue)
  ├── POST /v1/domain/map   → URL discovery
  ├── POST /v1/domain/crawl → async domain crawl (via queue)
  ├── POST /v1/pdf          → sync PDF crawl
  └── GET  /v1/jobs/:jobId  → job status

Cloudflare Queue (async jobs)
  └── Queue Consumer → crawls → updates KV → delivers webhook

Cloudflare KV (job store)
  └── job:{jobId} → TTL 7 days
```

---

## Providers

| Provider | Key | Best For |
|---|---|---|
| ScrapingAnt | `ant` | Default, general web crawling |
| ScrapingBee | `bee` | JS-heavy sites |
| Firecrawl | `firecrawl` | PDFs, domain mapping |

> `/pdf` and `/domain/map` always use Firecrawl regardless of `provider` field.

---

## Authentication

All endpoints except `/v1/health` require a Bearer token:

```
Authorization: Bearer <SERVICE_TOKEN>
```

Returns `401` if missing or invalid.

---

## Endpoints

### GET /v1/health

Public. No auth required.

**Response 200**
```json
{
  "success": true,
  "message": "crawlgate is healthy.",
  "requestId": "uuid",
  "data": {
    "environment": "development",
    "timestamp": "2025-03-12T10:30:00.000Z"
  }
}
```

---

### POST /v1/url

Crawl a single URL synchronously.

**Request**
```json
{
  "url": "https://example.com",
  "provider": "ant",
  "waitMs": 3000,
  "useBrowser": true,
  "maxRetries": 2,
  "metadata": {}
}
```

| Field | Type | Required | Default |
|---|---|---|---|
| `url` | string (URL) | Yes | — |
| `provider` | `bee\|ant\|firecrawl` | No | `DEFAULT_PROVIDER` |
| `waitMs` | number (0–10000) | No | provider default |
| `useBrowser` | boolean | No | `true` |
| `maxRetries` | number (0–5) | No | provider default |
| `metadata` | object | No | `{}` |

**Response 200**
```json
{
  "success": true,
  "message": "Crawl completed successfully.",
  "requestId": "uuid",
  "data": {
    "url": "https://example.com",
    "hostname": "example.com",
    "markdown": "# Page content...",
    "statusCode": 200,
    "provider": "ant",
    "durationMs": 1234
  }
}
```

---

### POST /v1/batch

Crawl multiple URLs. **Sync** if URL count ≤ `SYNC_BATCH_THRESHOLD` and no `webhookUrl`. **Async** otherwise.

**Request**
```json
{
  "urls": ["https://example.com", "https://example.org"],
  "provider": "ant",
  "concurrency": 2,
  "waitMs": 3000,
  "useBrowser": true,
  "maxRetries": 2,
  "webhookUrl": "https://your-server.com/webhook",
  "metadata": {}
}
```

| Field | Type | Required | Default |
|---|---|---|---|
| `urls` | string[] (1–50) | Yes | — |
| `provider` | `bee\|ant\|firecrawl` | No | `DEFAULT_PROVIDER` |
| `concurrency` | number (1–5) | No | `1` |
| `waitMs` | number (0–10000) | No | provider default |
| `useBrowser` | boolean | No | `true` |
| `maxRetries` | number (0–5) | No | provider default |
| `webhookUrl` | string (URL) | No | — |
| `metadata` | object | No | `{}` |

**Response 200 (sync)**
```json
{
  "success": true,
  "message": "Crawl completed successfully.",
  "requestId": "uuid",
  "data": {
    "jobId": "uuid",
    "mode": "sync",
    "status": "completed",
    "urlCount": 2,
    "successCount": 2,
    "failedCount": 0,
    "results": [
      {
        "url": "https://example.com",
        "hostname": "example.com",
        "markdown": "# Content...",
        "statusCode": 200,
        "provider": "ant",
        "durationMs": 1234
      }
    ]
  }
}
```

**Response 202 (async)**
```json
{
  "success": true,
  "message": "Crawl job queued. Results will be delivered to your webhook.",
  "requestId": "uuid",
  "data": {
    "jobId": "uuid",
    "mode": "async",
    "status": "queued",
    "urlCount": 5,
    "successCount": null,
    "failedCount": null,
    "results": null
  }
}
```

---

### POST /v1/domain/map

Discover all crawlable URLs for a domain using Firecrawl.

**Request**
```json
{
  "domain": "https://example.com",
  "maxUrls": 100,
  "includeSubdomains": false,
  "metadata": {}
}
```

| Field | Type | Required | Default |
|---|---|---|---|
| `domain` | string (URL) | Yes | — |
| `maxUrls` | number (1–500) | No | `100` |
| `includeSubdomains` | boolean | No | `false` |
| `metadata` | object | No | `{}` |

**Response 200**
```json
{
  "success": true,
  "message": "Domain URLs mapped successfully.",
  "requestId": "uuid",
  "data": {
    "domain": "https://example.com",
    "urls": ["https://example.com/about", "https://example.com/blog"],
    "total": 42
  }
}
```

---

### POST /v1/domain/crawl

Discover and crawl all URLs for a domain. Always async — requires `webhookUrl`.

**Request**
```json
{
  "domain": "https://example.com",
  "provider": "ant",
  "maxUrls": 100,
  "concurrency": 2,
  "waitMs": 3000,
  "useBrowser": true,
  "maxRetries": 2,
  "webhookUrl": "https://your-server.com/webhook",
  "metadata": {}
}
```

| Field | Type | Required | Default |
|---|---|---|---|
| `domain` | string (URL) | Yes | — |
| `provider` | `bee\|ant\|firecrawl` | No | `DEFAULT_PROVIDER` |
| `maxUrls` | number (1–500) | No | `100` |
| `concurrency` | number (1–5) | No | `1` |
| `waitMs` | number (0–10000) | No | provider default |
| `useBrowser` | boolean | No | `true` |
| `maxRetries` | number (0–5) | No | provider default |
| `webhookUrl` | string (URL) | **Yes** | — |
| `metadata` | object | No | `{}` |

**Response 202**
```json
{
  "success": true,
  "message": "Crawl job queued. Results will be delivered to your webhook.",
  "requestId": "uuid",
  "data": {
    "jobId": "uuid",
    "domain": "https://example.com",
    "mode": "async"
  }
}
```

---

### POST /v1/pdf

Crawl a PDF and return it as markdown. Always uses Firecrawl.

**Request**
```json
{
  "url": "https://example.com/document.pdf",
  "metadata": {}
}
```

| Field | Type | Required |
|---|---|---|
| `url` | string (URL) | Yes |
| `metadata` | object | No |

**Response 200**
```json
{
  "success": true,
  "message": "PDF crawled successfully.",
  "requestId": "uuid",
  "data": {
    "url": "https://example.com/document.pdf",
    "hostname": "example.com",
    "markdown": "# PDF content...",
    "statusCode": 200,
    "provider": "firecrawl",
    "durationMs": 2345
  }
}
```

---

### GET /v1/jobs/:jobId

Poll async job status.

**Response 200**
```json
{
  "success": true,
  "message": "Job found.",
  "requestId": "uuid",
  "data": {
    "jobId": "uuid",
    "type": "batch-crawl",
    "status": "completed",
    "provider": "ant",
    "triggeredAt": "2025-03-12T10:00:00.000Z",
    "completedAt": "2025-03-12T10:05:00.000Z",
    "urlCount": 10,
    "successCount": 9,
    "failedCount": 1,
    "failedUrls": [
      {
        "url": "https://example.com/broken",
        "statusCode": 404,
        "error": "Page not found",
        "provider": "ant",
        "durationMs": 500
      }
    ],
    "webhookUrl": "https://your-server.com/webhook",
    "metadata": {}
  }
}
```

**Job Status Values**

| Status | Meaning |
|---|---|
| `queued` | Job created, not yet picked up |
| `processing` | Queue worker is crawling |
| `completed` | All URLs crawled successfully |
| `partial` | Some URLs failed |
| `failed` | All URLs failed |

> Jobs expire from KV after **7 days**.

---

## Async Job Flow

```
POST /batch or /domain/crawl
  │
  ├── Create job record (status: queued)
  ├── Enqueue message
  └── Return 202 { jobId }

Queue Worker
  │
  ├── Phase 1: Resolve URLs (retryable on failure)
  │     ├── batch-crawl: use provided URLs
  │     └── domain-crawl: call Firecrawl /map
  │
  ├── Phase 2: Crawl URLs (acked, no re-crawl on retry)
  │     ├── Run with concurrency control (p-limit)
  │     └── Update job record
  │
  └── Deliver webhook
```

---

## Webhook Delivery

When a job completes, the service POSTs to your `webhookUrl`:

**Headers**
```
Content-Type: application/json
X-Scraping-Signature: <hmac-sha256-hex>
X-Scraping-Job-Id: <jobId>
```

**Payload**
```json
{
  "jobId": "uuid",
  "status": "completed",
  "results": [...],
  "successCount": 9,
  "failedCount": 1,
  "metadata": {},
  "triggeredAt": "2025-03-12T10:00:00.000Z",
  "completedAt": "2025-03-12T10:05:00.000Z",
  "signature": "abc123..."
}
```

**Verifying the Signature**

```js
const crypto = require("crypto");

function verifyWebhook(payload, receivedSig, secret) {
  const message = `${payload.jobId}.${payload.completedAt}.${payload.status}`;
  const expected = crypto.createHmac("sha256", secret).update(message).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(receivedSig));
}
```

**Retry Policy**
- Max retries: `WEBHOOK_MAX_RETRIES` (default: 3)
- Backoff: exponential, base `WEBHOOK_RETRY_BASE_MS` (default: 2000ms)
- Retried on: `408`, `429`, `5xx`
- Not retried on: `2xx`, `4xx` (except 408)

---

## Environment Setup

### Secrets (via `wrangler secret put`)

| Secret | Description |
|---|---|
| `SERVICE_TOKEN` | Bearer token for API auth |
| `WEBHOOK_SECRET` | HMAC-SHA256 signing secret |
| `SCRAPINGANT_API_KEY` | ScrapingAnt API key |
| `SCRAPINGBEE_API_KEY` | ScrapingBee API key |
| `FIRECRAWL_API_KEY` | Firecrawl API key |

### Config Variables (in `wrangler.jsonc`)

| Variable | Default | Description |
|---|---|---|
| `ENVIRONMENT` | — | `development` |
| `DEFAULT_PROVIDER` | `ant` | Fallback provider |
| `SYNC_BATCH_THRESHOLD` | `3` | Max URLs for sync mode |
| `SCRAPINGANT_BASE_URL` | `https://api.scrapingant.com` | ScrapingAnt base URL |
| `SCRAPINGBEE_CONCURRENCY` | `1` | Concurrent requests to ScrapingBee |
| `SCRAPINGBEE_WAIT_MS` | `3000` | JS wait time |
| `SCRAPINGBEE_MAX_RETRIES` | `2` | Retry attempts |
| `SCRAPINGANT_CONCURRENCY` | `1` | Concurrent requests to ScrapingAnt |
| `SCRAPINGANT_MAX_RETRIES` | `3` | Retry attempts |
| `FIRECRAWL_MAX_CONCURRENCY` | `5` | Concurrent Firecrawl requests |
| `FIRECRAWL_POLL_INTERVAL_MS` | `2000` | Firecrawl polling interval |
| `WEBHOOK_MAX_RETRIES` | `3` | Max webhook delivery attempts |
| `WEBHOOK_RETRY_BASE_MS` | `2000` | Webhook backoff base delay |

---

## Deployment

### 1. Create KV Namespaces

```bash
npx wrangler kv namespace create "dev-crawl-job-store"
```

Paste the returned ID into `wrangler.jsonc` under `kv_namespaces`.

### 2. Create Queue

```bash
npx wrangler queues create dev-crawl-job-queue
```

### 3. Set Secrets

```bash
npx wrangler secret put SERVICE_TOKEN --env development
npx wrangler secret put WEBHOOK_SECRET --env development
npx wrangler secret put SCRAPINGANT_API_KEY --env development
npx wrangler secret put SCRAPINGBEE_API_KEY --env development
npx wrangler secret put FIRECRAWL_API_KEY --env development
```

> Generate a secure `WEBHOOK_SECRET`: `openssl rand -hex 32`

### 4. Deploy

```bash
npx wrangler deploy --env development
```

### Deployed URL

`https://dev-crawlgate.satyajakkampudidev.workers.dev`

---

## Error Responses

All errors follow this envelope:

```json
{
  "success": false,
  "message": "Error description",
  "requestId": "uuid",
  "errors": {
    "fieldName": ["Validation error message"]
  }
}
```

| Status | Meaning |
|---|---|
| `400` | Bad request / invalid input |
| `401` | Missing or invalid `SERVICE_TOKEN` |
| `404` | Route or job not found |
| `422` | Validation error (field-level errors in `errors`) |
| `502` | Provider API error |
| `503` | Provider API key missing or unavailable |
| `500` | Unexpected internal error |
