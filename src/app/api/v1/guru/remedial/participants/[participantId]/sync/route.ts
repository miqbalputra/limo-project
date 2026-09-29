import { requireActor, requireRole } from "@/server/auth/session";
import { getEnv } from "@/server/env";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { assertSameOrigin } from "@/server/security/origin";
import { syncRemedialParticipant } from "@/server/services/remedial-service";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ participantId: string }> }) {
  const requestId = getRequestId(request.headers);
  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    const actor = await requireActor();
    requireRole(actor, ["ADMIN", "GURU"]);
    const { participantId } = await params;
    return apiOk(await syncRemedialParticipant(actor, participantId), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
