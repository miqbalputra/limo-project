import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { submitPendaftaran } from "@/server/services/pendaftaran-service";
import { getEnv } from "@/server/env";
import { assertSameOrigin } from "@/server/security/origin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = getRequestId(request.headers);

  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    const result = await submitPendaftaran(await request.json(), {
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
    });

    return apiOk(result, { requestId }, { status: 201 });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
