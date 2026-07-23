import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { getEnv } from "@/server/env";
import { assertSameOrigin } from "@/server/security/origin";
import { requestPasswordReset } from "@/server/services/auth-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = getRequestId(request.headers);

  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    const result = await requestPasswordReset(await request.json(), { requestId });
    return apiOk(result, { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
