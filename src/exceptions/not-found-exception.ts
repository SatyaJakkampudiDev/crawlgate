import { NOT_FOUND } from "../constants/http-status-codes.js";
import { NOT_FOUND as NOT_FOUND_PHRASE } from "../constants/http-status-phrases.js";
import { createException } from "./base-exception.js";

export default function NotFoundException(message?: string, errData?: unknown) {
  return createException(NOT_FOUND, message ?? NOT_FOUND_PHRASE, NOT_FOUND_PHRASE, errData);
}
