import { requireActor } from "@/server/auth/session";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { getWaliGradebook } from "@/server/services/gradebook-service";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ siswaId: string; kelasId: string }> }) {
  const requestId = getRequestId(request.headers);
  try {
    const { siswaId, kelasId } = await params;
    return apiOk(await getWaliGradebook(await requireActor(), siswaId, kelasId), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
