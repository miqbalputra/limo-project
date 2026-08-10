import { requireActor } from "@/server/auth/session";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { getWaliModuleProgress } from "@/server/services/activity-completion-service";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ siswaId: string; kelasId: string }> }) {
  const requestId = getRequestId(request.headers);
  try {
    const { siswaId, kelasId } = await params;
    const moduleId = new URL(request.url).searchParams.get("moduleId") || undefined;
    return apiOk(await getWaliModuleProgress(await requireActor(), siswaId, kelasId, moduleId), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
