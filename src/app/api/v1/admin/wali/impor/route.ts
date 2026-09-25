import { requireActor, requireRole } from "@/server/auth/session";
import { getEnv } from "@/server/env";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { assertSameOrigin } from "@/server/security/origin";
import { importWaliCsv } from "@/server/services/people-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = getRequestId(request.headers);
  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    const actor = await requireActor();
    requireRole(actor, ["ADMIN"]);
    return apiOk(await importWaliCsv(actor, await request.json()), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
