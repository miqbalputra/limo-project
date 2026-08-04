import { requireActor } from "@/server/auth/session";
import { getEnv } from "@/server/env";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { assertSameOrigin } from "@/server/security/origin";
import { archiveLevel, updateLevel } from "@/server/services/master-data-service";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request.headers);
  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    const actor = await requireActor();
    const { id } = await context.params;
    return apiOk(await updateLevel(actor, id, await request.json()), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request.headers);
  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    const actor = await requireActor();
    const { id } = await context.params;
    return apiOk(await archiveLevel(actor, id), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
