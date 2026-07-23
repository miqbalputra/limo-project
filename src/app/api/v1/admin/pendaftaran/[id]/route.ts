import { requireActor } from "@/server/auth/session";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { getPendaftaranDetail } from "@/server/services/pendaftaran-service";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request.headers);

  try {
    const actor = await requireActor();
    const { id } = await context.params;
    const result = await getPendaftaranDetail(actor, id);
    return apiOk(result, { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
