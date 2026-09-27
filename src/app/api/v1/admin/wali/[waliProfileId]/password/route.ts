import { requireActor } from "@/server/auth/session";
import { getEnv } from "@/server/env";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { assertSameOrigin } from "@/server/security/origin";
import { setWaliPassword } from "@/server/services/people-service";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ waliProfileId: string }> }) {
  const requestId = getRequestId(request.headers);

  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    return apiOk(await setWaliPassword(await requireActor(), (await params).waliProfileId, await request.json()), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
