import { requireActor, requireRole } from "@/server/auth/session";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { getSessionRoster } from "@/server/services/attendance-progress-service";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ sesiKelasId: string }> }) {
  const requestId = getRequestId(request.headers);

    try {
      const actor = await requireActor();
      requireRole(actor, ["GURU"]);
      const { sesiKelasId } = await context.params;
      return apiOk(await getSessionRoster(actor, sesiKelasId), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
