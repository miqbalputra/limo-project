import { requireActor } from "@/server/auth/session";
import { getEnv } from "@/server/env";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { assertSameOrigin } from "@/server/security/origin";
import { markManualCompletion } from "@/server/services/activity-completion-service";

export const runtime = "nodejs";

export async function PUT(request: Request, { params }: { params: Promise<{ kelasId: string; studentId: string; itemId: string }> }) {
  const requestId = getRequestId(request.headers);
  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    const { kelasId, studentId, itemId } = await params;
    return apiOk(await markManualCompletion(await requireActor(), kelasId, studentId, itemId, await request.json()), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
