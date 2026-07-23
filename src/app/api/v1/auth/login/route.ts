import { cookies } from "next/headers";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { getEnv } from "@/server/env";
import { assertSameOrigin } from "@/server/security/origin";
import { getSessionCookieOptions } from "@/server/auth/session";
import { login } from "@/server/services/auth-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = getRequestId(request.headers);

  try {
    const env = getEnv();
    assertSameOrigin(request.headers, env.APP_URL);

    const result = await login(await request.json(), {
      userAgent: request.headers.get("user-agent"),
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
    });

    const cookieStore = await cookies();
    cookieStore.set(
      env.SESSION_COOKIE_NAME,
      result.session.token,
      getSessionCookieOptions(result.session.expiresAt),
    );

    return apiOk({ actor: result.actor }, { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
