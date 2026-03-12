import { BAD_GATEWAY } from "../constants/http-status-codes.js";
import { BAD_GATEWAY as BAD_GATEWAY_PHRASE } from "../constants/http-status-phrases.js";
import { createException } from "./base-exception.js";

export default function BadGatewayException(message?: string, errData?: unknown) {
  return createException(BAD_GATEWAY, message ?? BAD_GATEWAY_PHRASE, BAD_GATEWAY_PHRASE, errData);
}
