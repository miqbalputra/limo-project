import { requireActor } from "@/server/auth/session";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { getStudentPublishedGrade } from "@/server/services/rubric-service";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ submissionId: string }> }) {
  const requestId = getRequestId(request.headers);
  try {
    return apiOk(await getStudentPublishedGrade(await requireActor(), (await params).submissionId), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
