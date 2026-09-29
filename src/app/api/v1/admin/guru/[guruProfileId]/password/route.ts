import { requireActorWithRole } from "@/server/auth/session";
import { getEnv } from "@/server/env";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { assertSameOrigin } from "@/server/security/origin";
import { setGuruPassword } from "@/server/services/people-service";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ guruProfileId: string }> }) {
  const requestId = getRequestId(request.headers);

  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    return apiOk(await setGuruPassword(await requireActorWithRole(["ADMIN"]), (await params).guruProfileId, await request.json()), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
