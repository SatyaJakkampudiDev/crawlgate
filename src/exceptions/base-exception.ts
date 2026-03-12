import type { StatusCode } from "hono/utils/http-status";

export interface BaseExceptionShape extends Error {
  status: StatusCode;
  isOperational: boolean;
  errData?: unknown;
}

export function createException(
  status: StatusCode,
  message: string,
  name: string,
  errData?: unknown,
): BaseExceptionShape {
  const err = new Error(message) as BaseExceptionShape;
  err.name = name;
  err.status = status;
  err.isOperational = true;
  if (errData !== undefined)
    err.errData = errData;
  return err;
}

export function isBaseException(err: unknown): err is BaseExceptionShape {
  return err instanceof Error && "isOperational" in err;
}
