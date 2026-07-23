import { requireActor } from "@/server/auth/session";
import { getEnv } from "@/server/env";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { assertSameOrigin } from "@/server/security/origin";
import { removeSiswaWali } from "@/server/services/people-service";

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; waliProfileId: string }> }) {
  const requestId = getRequestId(request.headers);
  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    const actor = await requireActor();
    const values = await params;
    return apiOk(await removeSiswaWali(actor, values.id, values.waliProfileId), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
