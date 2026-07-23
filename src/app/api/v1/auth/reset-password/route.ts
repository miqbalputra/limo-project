import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { getEnv } from "@/server/env";
import { assertSameOrigin } from "@/server/security/origin";
import { resetPassword } from "@/server/services/auth-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = getRequestId(request.headers);

  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    const result = await resetPassword(await request.json());
    return apiOk(result, { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
