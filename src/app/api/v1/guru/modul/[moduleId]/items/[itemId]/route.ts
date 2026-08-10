import { requireActor } from "@/server/auth/session";
import { getEnv } from "@/server/env";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { assertSameOrigin } from "@/server/security/origin";
import { deleteModuleItem } from "@/server/services/learning-module-service";
import { upsertCompletionRule } from "@/server/services/activity-completion-service";

export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: { params: Promise<{ moduleId: string; itemId: string }> }) {
  const requestId = getRequestId(request.headers);
  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    return apiOk(await upsertCompletionRule(await requireActor(), (await params).itemId, await request.json()), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ moduleId: string; itemId: string }> }) {
  const requestId = getRequestId(request.headers);
  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    const actor = await requireActor();
    const { moduleId, itemId } = await params;
    return apiOk(await deleteModuleItem(actor, moduleId, itemId), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
