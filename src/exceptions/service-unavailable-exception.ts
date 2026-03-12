import { SERVICE_UNAVAILABLE } from "../constants/http-status-codes.js";
import { SERVICE_UNAVAILABLE as SERVICE_UNAVAILABLE_PHRASE } from "../constants/http-status-phrases.js";
import { createException } from "./base-exception.js";

export default function ServiceUnavailableException(message?: string, errData?: unknown) {
  return createException(SERVICE_UNAVAILABLE, message ?? SERVICE_UNAVAILABLE_PHRASE, SERVICE_UNAVAILABLE_PHRASE, errData);
}
