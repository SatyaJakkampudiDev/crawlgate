import { TOO_MANY_REQUESTS } from "../constants/http-status-codes.js";
import { TOO_MANY_REQUESTS as TOO_MANY_REQUESTS_PHRASE } from "../constants/http-status-phrases.js";
import { createException } from "./base-exception.js";

export default function TooManyRequestsException(message?: string, errData?: unknown) {
  return createException(TOO_MANY_REQUESTS, message ?? TOO_MANY_REQUESTS_PHRASE, TOO_MANY_REQUESTS_PHRASE, errData);
}
