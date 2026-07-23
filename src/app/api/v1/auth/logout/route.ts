import { cookies } from "next/headers";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { getEnv } from "@/server/env";
import { getExpiredSessionCookieOptions } from "@/server/auth/session";
import { assertSameOrigin } from "@/server/security/origin";
import { logout } from "@/server/services/auth-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = getRequestId(request.headers);

  try {
    const env = getEnv();
    assertSameOrigin(request.headers, env.APP_URL);

    const cookieStore = await cookies();
    const token = cookieStore.get(env.SESSION_COOKIE_NAME)?.value;

    await logout(token);
    cookieStore.set(env.SESSION_COOKIE_NAME, "", getExpiredSessionCookieOptions());

    return apiOk({ success: true }, { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
