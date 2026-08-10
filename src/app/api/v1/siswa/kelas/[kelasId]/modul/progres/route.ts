import { requireActor } from "@/server/auth/session";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { getStudentModuleProgress } from "@/server/services/activity-completion-service";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ kelasId: string }> }) {
  const requestId = getRequestId(request.headers);
  try {
    const moduleId = new URL(request.url).searchParams.get("moduleId") || undefined;
    return apiOk(await getStudentModuleProgress(await requireActor(), (await params).kelasId, moduleId), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
