import { requireActor } from "@/server/auth/session";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { listStudentClasses } from "@/server/services/student-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestId = getRequestId(request.headers);
  try {
    return apiOk(await listStudentClasses(await requireActor()), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
