import { requireActor } from "@/server/auth/session";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { listWaliAssignments } from "@/server/services/assignment-service";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ siswaId: string; kelasId: string }> }) {
  const requestId = getRequestId(request.headers);
  try {
    const actor = await requireActor();
    const { siswaId, kelasId } = await params;
    return apiOk(await listWaliAssignments(actor, siswaId, kelasId), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
