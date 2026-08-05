import { requireActor } from "@/server/auth/session";
import { getEnv } from "@/server/env";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { assertSameOrigin } from "@/server/security/origin";
import { saveAssignmentDraft } from "@/server/services/assignment-service";

export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: { params: Promise<{ assignmentId: string }> }) {
  const requestId = getRequestId(request.headers);
  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    const actor = await requireActor();
    return apiOk(await saveAssignmentDraft(actor, (await params).assignmentId, await request.json()), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
