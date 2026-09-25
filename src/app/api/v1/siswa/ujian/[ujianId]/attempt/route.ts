import { requireActor } from "@/server/auth/session";
import { getEnv } from "@/server/env";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { assertSameOrigin } from "@/server/security/origin";
import { startStudentExamAttempt } from "@/server/services/online-exam-service";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ ujianId: string }> }) {
  const requestId = getRequestId(request.headers);

  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    const actor = await requireActor();
    const { ujianId } = await params;
    return apiOk(await startStudentExamAttempt(actor, ujianId), { requestId }, { status: 201 });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
