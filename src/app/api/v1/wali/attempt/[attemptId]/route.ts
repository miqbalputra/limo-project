import { requireActor } from "@/server/auth/session";
import { getEnv } from "@/server/env";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { assertSameOrigin } from "@/server/security/origin";
import { saveWaliAttemptDraft } from "@/server/services/online-exam-service";

export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const requestId = getRequestId(request.headers);

  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    const actor = await requireActor();
    const { attemptId } = await params;
    return apiOk(await saveWaliAttemptDraft(actor, attemptId, await request.json()), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
