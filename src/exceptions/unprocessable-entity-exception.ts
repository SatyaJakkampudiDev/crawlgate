import { UNPROCESSABLE_ENTITY } from "../constants/http-status-codes.js";
import { UNPROCESSABLE_ENTITY as UNPROCESSABLE_ENTITY_PHRASE } from "../constants/http-status-phrases.js";
import { createException } from "./base-exception.js";

export default function UnprocessableEntityException(message?: string, errData?: unknown) {
  return createException(UNPROCESSABLE_ENTITY, message ?? UNPROCESSABLE_ENTITY_PHRASE, UNPROCESSABLE_ENTITY_PHRASE, errData);
}
