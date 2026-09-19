import { getEnv } from "@/server/env";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { assertSameOrigin } from "@/server/security/origin";
import { submitPublicQuizResponse } from "@/server/services/public-quiz-service";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ token: string; responseId: string }> }) {
  const requestId = getRequestId(request.headers);

  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    const { token, responseId } = await context.params;
    const body = await request.json().catch(() => ({}));
    return apiOk(await submitPublicQuizResponse(token, responseId, body), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
