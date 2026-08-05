import { requireActor } from "@/server/auth/session";
import { getEnv } from "@/server/env";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { assertSameOrigin } from "@/server/security/origin";
import { updateMateriStatus } from "@/server/services/lms-service";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ materiId: string }> }) {
  const requestId = getRequestId(request.headers);
  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    const actor = await requireActor();
    const { materiId } = await context.params;
    return apiOk(await updateMateriStatus(actor, materiId, await request.json()), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
