import { requireActor } from "@/server/auth/session";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { listStudentExams } from "@/server/services/online-exam-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestId = getRequestId(request.headers);
  try {
    return apiOk(await listStudentExams(await requireActor()), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
