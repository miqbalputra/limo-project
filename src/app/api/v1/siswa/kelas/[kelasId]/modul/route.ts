import { requireActor } from "@/server/auth/session";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { listStudentModules } from "@/server/services/learning-module-service";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ kelasId: string }> }) {
  const requestId = getRequestId(request.headers);
  try {
    const actor = await requireActor();
    return apiOk(await listStudentModules(actor, (await params).kelasId), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
