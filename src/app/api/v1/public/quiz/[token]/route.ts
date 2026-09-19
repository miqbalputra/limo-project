import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { getPublicQuizIntro } from "@/server/services/public-quiz-service";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ token: string }> }) {
  const requestId = getRequestId(request.headers);

  try {
    const { token } = await context.params;
    return apiOk(await getPublicQuizIntro(token), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
