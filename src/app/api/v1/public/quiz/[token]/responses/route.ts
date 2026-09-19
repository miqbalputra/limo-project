import { getEnv } from "@/server/env";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { assertSameOrigin } from "@/server/security/origin";
import { startPublicQuizResponse } from "@/server/services/public-quiz-service";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const requestId = getRequestId(request.headers);

  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    const { token } = await context.params;
    const body = await request.json().catch(() => ({}));
    const result = await startPublicQuizResponse(token, body, {
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
    });
    return apiOk(result, { requestId }, { status: 201 });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
