import { requireActor, requireRole } from "@/server/auth/session";
import { getEnv } from "@/server/env";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { assertSameOrigin } from "@/server/security/origin";
import { gradeQuizResponse } from "@/server/services/quiz-builder-service";

export const runtime = "nodejs";

export async function PATCH(request: Request, context: { params: Promise<{ id: string; responseId: string }> }) {
  const requestId = getRequestId(request.headers);
  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    const actor = await requireActor();
    requireRole(actor, ["GURU", "ADMIN"]);
    const { id, responseId } = await context.params;
    return apiOk(await gradeQuizResponse(actor, id, responseId, await request.json()), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
