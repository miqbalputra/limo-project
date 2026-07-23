import { requireActor } from "@/server/auth/session";
import { getEnv } from "@/server/env";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { assertSameOrigin } from "@/server/security/origin";
import { revokeUserSessions } from "@/server/services/auth-service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request.headers);
  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    return apiOk(await revokeUserSessions(await requireActor(), (await params).id), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
