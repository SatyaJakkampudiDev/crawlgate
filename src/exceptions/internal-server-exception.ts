import { INTERNAL_SERVER_ERROR } from "../constants/http-status-codes.js";
import { INTERNAL_SERVER_ERROR as INTERNAL_SERVER_ERROR_PHRASE } from "../constants/http-status-phrases.js";
import { createException } from "./base-exception.js";

export default function InternalServerException(message?: string, errData?: unknown) {
  return createException(INTERNAL_SERVER_ERROR, message ?? INTERNAL_SERVER_ERROR_PHRASE, INTERNAL_SERVER_ERROR_PHRASE, errData);
}
