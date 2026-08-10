import { requireActor, requireRole } from "@/server/auth/session";
import { getEnv } from "@/server/env";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { assertSameOrigin } from "@/server/security/origin";
import { cancelSesiKelas, updateSesiKelas } from "@/server/services/lms-service";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ sesiKelasId: string }> }) {
  const requestId = getRequestId(request.headers);

  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    const actor = await requireActor();
    requireRole(actor, ["GURU"]);
    const { sesiKelasId } = await context.params;
    return apiOk(await updateSesiKelas(actor, sesiKelasId, await request.json()), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ sesiKelasId: string }> }) {
  const requestId = getRequestId(request.headers);

  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    const actor = await requireActor();
    requireRole(actor, ["GURU"]);
    const { sesiKelasId } = await context.params;
    return apiOk(await cancelSesiKelas(actor, sesiKelasId, await request.json().catch(() => ({}))), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
