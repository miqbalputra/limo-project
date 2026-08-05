import { ForbiddenError } from "@/server/errors/application-error";

function isLoopbackHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

export function assertSameOrigin(headers: Headers, appUrl: string) {
  const origin = headers.get("origin");

  if (!origin) {
    throw new ForbiddenError("Origin request wajib disertakan");
  }

  const expected = new URL(appUrl);
  const actual = new URL(origin);

  const exactMatch = actual.protocol === expected.protocol && actual.host === expected.host;
  const developmentLoopbackAlias = process.env.NODE_ENV !== "production"
    && expected.protocol === "http:"
    && actual.protocol === "http:"
    && expected.port === actual.port
    && isLoopbackHost(expected.hostname)
    && isLoopbackHost(actual.hostname);

  if (!exactMatch && !developmentLoopbackAlias) {
    throw new ForbiddenError("Origin request tidak valid");
  }
}
