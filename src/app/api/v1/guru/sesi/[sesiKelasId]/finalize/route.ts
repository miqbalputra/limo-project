import { requireActor } from "@/server/auth/session";
import { getEnv } from "@/server/env";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { assertSameOrigin } from "@/server/security/origin";
import { finalizeSesiKelas } from "@/server/services/attendance-progress-service";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ sesiKelasId: string }> }) {
  const requestId = getRequestId(request.headers);

  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    const actor = await requireActor();
    const { sesiKelasId } = await context.params;
    return apiOk(await finalizeSesiKelas(actor, sesiKelasId), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
