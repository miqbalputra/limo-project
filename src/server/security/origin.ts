import { ForbiddenError } from "@/server/errors/application-error";

export function assertSameOrigin(headers: Headers, appUrl: string) {
  const origin = headers.get("origin");

  if (!origin) {
    throw new ForbiddenError("Origin request wajib disertakan");
  }

  const expected = new URL(appUrl);
  const actual = new URL(origin);

  if (actual.protocol !== expected.protocol || actual.host !== expected.host) {
    throw new ForbiddenError("Origin request tidak valid");
  }
}
