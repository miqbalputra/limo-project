import { requireActor } from "@/server/auth/session";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { getEnv } from "@/server/env";
import { assertSameOrigin } from "@/server/security/origin";
import { rejectPendaftaran } from "@/server/services/pendaftaran-service";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request.headers);

  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    const actor = await requireActor();
    const { id } = await context.params;
    const result = await rejectPendaftaran(actor, id, await request.json());
    return apiOk(result, { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
