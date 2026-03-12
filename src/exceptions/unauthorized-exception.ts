import { UNAUTHORIZED } from "../constants/http-status-codes.js";
import { UNAUTHORIZED as UNAUTHORIZED_PHRASE } from "../constants/http-status-phrases.js";
import { createException } from "./base-exception.js";

export default function UnauthorizedException(message?: string, errData?: unknown) {
  return createException(UNAUTHORIZED, message ?? UNAUTHORIZED_PHRASE, UNAUTHORIZED_PHRASE, errData);
}
