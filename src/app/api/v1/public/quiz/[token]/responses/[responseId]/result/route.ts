import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { getPublicQuizResult } from "@/server/services/public-quiz-service";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ token: string; responseId: string }> }) {
  const requestId = getRequestId(request.headers);

  try {
    const { token, responseId } = await context.params;
    return apiOk(await getPublicQuizResult(token, responseId), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
