import { requireActor } from "@/server/auth/session";
import { getEnv } from "@/server/env";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { assertSameOrigin } from "@/server/security/origin";
import { reorderModuleItems } from "@/server/services/learning-module-service";

export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: { params: Promise<{ moduleId: string }> }) {
  const requestId = getRequestId(request.headers);
  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    const actor = await requireActor();
    return apiOk(await reorderModuleItems(actor, (await params).moduleId, await request.json()), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
