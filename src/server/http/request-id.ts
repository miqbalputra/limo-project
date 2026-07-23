import { randomUUID } from "node:crypto";

export const REQUEST_ID_HEADER = "x-request-id";

export function getRequestId(headers: Headers) {
  const incoming = headers.get(REQUEST_ID_HEADER);

  if (incoming && /^[a-zA-Z0-9._:-]{8,128}$/.test(incoming)) {
    return incoming;
  }

  return randomUUID();
}
