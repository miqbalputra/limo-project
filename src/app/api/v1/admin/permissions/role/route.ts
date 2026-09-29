import { requireActor } from "@/server/auth/session";
import { requirePermission } from "@/server/auth/permissions";
import { getEnv } from "@/server/env";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { assertSameOrigin } from "@/server/security/origin";
import { setRolePermission } from "@/server/services/permission-service";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  const requestId = getRequestId(request.headers);
  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    const actor = await requireActor();
    await requirePermission(actor, "admin.permissions.manage");
    return apiOk(await setRolePermission(actor, await request.json()), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
