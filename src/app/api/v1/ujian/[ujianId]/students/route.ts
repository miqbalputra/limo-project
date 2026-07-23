import { requireActor } from "@/server/auth/session";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { listExamStudents } from "@/server/services/exam-service";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ ujianId: string }> }) {
  const requestId = getRequestId(request.headers);

  try {
    const actor = await requireActor();
    const { ujianId } = await context.params;
    return apiOk(await listExamStudents(actor, ujianId), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
