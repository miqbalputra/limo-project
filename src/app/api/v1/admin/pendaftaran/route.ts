import { requireActor } from "@/server/auth/session";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { listPendaftaran } from "@/server/services/pendaftaran-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestId = getRequestId(request.headers);

  try {
    const actor = await requireActor();
    const result = await listPendaftaran(actor);
    return apiOk(result, { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
