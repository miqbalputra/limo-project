import { requireActor, requireRole } from "@/server/auth/session";
import { getEnv } from "@/server/env";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { assertSameOrigin } from "@/server/security/origin";
import { resendGuruActivation } from "@/server/services/people-service";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ guruProfileId: string }> }) {
  const requestId = getRequestId(request.headers);
  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    const actor = await requireActor();
    requireRole(actor, ["ADMIN"]);
    const { guruProfileId } = await context.params;
    return apiOk(await resendGuruActivation(actor, guruProfileId), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
