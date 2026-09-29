import { requireActor } from "@/server/auth/session";
import { requirePermission } from "@/server/auth/permissions";
import { getEnv } from "@/server/env";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { assertSameOrigin } from "@/server/security/origin";
import { listUserPermissionOverrides, setUserPermissionOverride } from "@/server/services/permission-service";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request.headers);
  try {
    const actor = await requireActor();
    await requirePermission(actor, "admin.permissions.manage");
    const { id } = await params;
    return apiOk(await listUserPermissionOverrides(actor, id), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request.headers);
  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    const actor = await requireActor();
    await requirePermission(actor, "admin.permissions.manage");
    const { id } = await params;
    return apiOk(await setUserPermissionOverride(actor, id, await request.json()), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
