import { requireActor, requireRole } from "@/server/auth/session";
import { getEnv } from "@/server/env";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { assertSameOrigin } from "@/server/security/origin";
import { updateRpp, updateRppStatus } from "@/server/services/rpp-service";

export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: { params: Promise<{ rppId: string }> }) {
  const requestId = getRequestId(request.headers);
  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    const actor = await requireActor();
    requireRole(actor, ["ADMIN", "GURU"]);
    const { rppId } = await params;
    return apiOk(await updateRppStatus(actor, rppId, await request.json()), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ rppId: string }> }) {
  const requestId = getRequestId(request.headers);
  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    const actor = await requireActor();
    requireRole(actor, ["ADMIN", "GURU"]);
    const { rppId } = await params;
    return apiOk(await updateRpp(actor, rppId, await request.json()), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
