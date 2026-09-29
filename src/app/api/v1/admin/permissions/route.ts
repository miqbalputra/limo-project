import { requireActor } from "@/server/auth/session";
import { requirePermission } from "@/server/auth/permissions";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { getPermissionMatrix } from "@/server/services/permission-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestId = getRequestId(request.headers);
  try {
    const actor = await requireActor();
    await requirePermission(actor, "admin.permissions.manage");
    return apiOk(await getPermissionMatrix(actor), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
