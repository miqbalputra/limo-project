import { requireActor } from "@/server/auth/session";
import { getEnv } from "@/server/env";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { assertSameOrigin } from "@/server/security/origin";
import { getSubmissionGradeContext, saveSubmissionGrade } from "@/server/services/rubric-service";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ submissionId: string }> }) {
  const requestId = getRequestId(request.headers);
  try {
    return apiOk(await getSubmissionGradeContext(await requireActor(), (await params).submissionId), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ submissionId: string }> }) {
  const requestId = getRequestId(request.headers);
  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    return apiOk(await saveSubmissionGrade(await requireActor(), (await params).submissionId, await request.json()), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
