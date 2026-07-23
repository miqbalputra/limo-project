import { cookies } from "next/headers";
import { createSession, getSessionCookieOptions, requireActor } from "@/server/auth/session";
import { getEnv } from "@/server/env";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { assertSameOrigin } from "@/server/security/origin";
import { changePassword } from "@/server/services/auth-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = getRequestId(request.headers);

  try {
    const env = getEnv();
    assertSameOrigin(request.headers, env.APP_URL);
    const actor = await requireActor();
    await changePassword(actor, await request.json());
    const session = await createSession({
      userId: actor.id,
      userAgent: request.headers.get("user-agent"),
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
    });
    const cookieStore = await cookies();
    cookieStore.set(env.SESSION_COOKIE_NAME, session.token, getSessionCookieOptions(session.expiresAt));

    return apiOk({ success: true }, { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
