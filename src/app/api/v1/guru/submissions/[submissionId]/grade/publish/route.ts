import { requireActor } from "@/server/auth/session";
import { getEnv } from "@/server/env";
import { ValidationError } from "@/server/errors/application-error";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { assertSameOrigin } from "@/server/security/origin";
import { publishSubmissionGrade } from "@/server/services/rubric-service";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ submissionId: string }> }) {
  const requestId = getRequestId(request.headers);
  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    const body = (await request.json()) as { gradeId?: string };
    if (!body.gradeId) throw new ValidationError("gradeId wajib diisi");
    return apiOk(await publishSubmissionGrade(await requireActor(), (await params).submissionId, body.gradeId), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
