import { requireActor, requireRole } from "@/server/auth/session";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { listEssayReviewQueue } from "@/server/services/exam-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestId = getRequestId(request.headers);

  try {
    const actor = await requireActor();
    requireRole(actor, ["GURU"]);
    const searchParams = new URL(request.url).searchParams;
    return apiOk(await listEssayReviewQueue(actor, {
      page: Number(searchParams.get("page")) || 1,
      pageSize: Number(searchParams.get("pageSize")) || 30,
    }), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
