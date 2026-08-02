import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { getEnv } from "@/server/env";
import { assertSameOrigin } from "@/server/security/origin";
import { assertRateLimit, getClientAddress } from "@/server/security/rate-limit";
import { resetPassword } from "@/server/services/auth-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = getRequestId(request.headers);

  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    assertRateLimit({
      key: `reset-password:${getClientAddress(request.headers)}`,
      limit: 10,
      windowMs: 15 * 60 * 1000,
      message: "Terlalu banyak percobaan reset password. Coba lagi nanti",
    });
    const result = await resetPassword(await request.json());
    return apiOk(result, { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
