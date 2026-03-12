import type { CrawlResult } from "../types/crawl-types.js";

import pLimit from "p-limit";

type CrawlTask = () => Promise<CrawlResult>;

interface RunConcurrentOptions {
  tasks: CrawlTask[];
  concurrency: number;
  onTaskComplete?: (result: CrawlResult, index: number) => void;
}

/**
 * Runs an array of crawl tasks with a maximum concurrency limit.
 * Results are collected in original URL order (Promise.all preserves order).
 */
export async function runConcurrent(options: RunConcurrentOptions): Promise<CrawlResult[]> {
  const { tasks, concurrency, onTaskComplete } = options;
  const limit = pLimit(concurrency);

  const limitedTasks = tasks.map((task, index) =>
    limit(async () => {
      const result = await task();
      onTaskComplete?.(result, index);
      return result;
    }),
  );

  return Promise.all(limitedTasks);
}

/**
 * Clamps a concurrency value between a minimum and maximum bound.
 * Prevents accidental 0 or excessive concurrency from misconfigured env vars.
 */
export function clampConcurrency(value: number, min: number, max: number): number {
  return Math.min(Math.max(Math.floor(value), min), max);
}
