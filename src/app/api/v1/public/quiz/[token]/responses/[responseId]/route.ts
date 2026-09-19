import { getEnv } from "@/server/env";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { assertSameOrigin } from "@/server/security/origin";
import { getPublicQuizResponseContext, savePublicQuizDraft } from "@/server/services/public-quiz-service";

export const runtime = "nodejs";

type Context = { params: Promise<{ token: string; responseId: string }> };

export async function GET(request: Request, context: Context) {
  const requestId = getRequestId(request.headers);

  try {
    const { token, responseId } = await context.params;
    return apiOk(await getPublicQuizResponseContext(token, responseId), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}

export async function PATCH(request: Request, context: Context) {
  const requestId = getRequestId(request.headers);

  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    const { token, responseId } = await context.params;
    const body = await request.json().catch(() => ({}));
    return apiOk(await savePublicQuizDraft(token, responseId, body), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
