import { getEnv } from "@/server/env";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { assertSameOrigin } from "@/server/security/origin";
import { uploadPublicQuizFile } from "@/server/services/public-quiz-service";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ token: string; responseId: string }> }) {
  const requestId = getRequestId(request.headers);

  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    const { token, responseId } = await context.params;
    const formData = await request.formData();
    const file = formData.get("file");
    const ujianSoalId = formData.get("ujianSoalId");
    return apiOk(await uploadPublicQuizFile(token, responseId, file instanceof File ? file : null, typeof ujianSoalId === "string" ? ujianSoalId : null), { requestId }, { status: 201 });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
