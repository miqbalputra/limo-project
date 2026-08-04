import { requireActor } from "@/server/auth/session";
import { getEnv } from "@/server/env";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { assertSameOrigin } from "@/server/security/origin";
import { duplicateSesiKelas } from "@/server/services/lms-service";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ sesiKelasId: string }> }) {
  const requestId = getRequestId(request.headers);

  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    const actor = await requireActor();
    const { sesiKelasId } = await context.params;
    return apiOk(await duplicateSesiKelas(actor, sesiKelasId), { requestId }, { status: 201 });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
