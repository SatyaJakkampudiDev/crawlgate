import { BAD_REQUEST } from "../constants/http-status-codes.js";
import { BAD_REQUEST as BAD_REQUEST_PHRASE } from "../constants/http-status-phrases.js";
import { createException } from "./base-exception.js";

export default function BadRequestException(message?: string, errData?: unknown) {
  return createException(BAD_REQUEST, message ?? BAD_REQUEST_PHRASE, BAD_REQUEST_PHRASE, errData);
}
