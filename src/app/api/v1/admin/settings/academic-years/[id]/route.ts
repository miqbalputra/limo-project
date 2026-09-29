import { requireActor, requireRole } from "@/server/auth/session";
import { getEnv } from "@/server/env";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { assertSameOrigin } from "@/server/security/origin";
import { setActiveAcademicYear, updateAcademicYear } from "@/server/services/settings-service";

export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request.headers);
  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    const actor = await requireActor();
    requireRole(actor, ["ADMIN"]);
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    if (body.isActive === true) {
      return apiOk(await setActiveAcademicYear(actor, id), { requestId });
    }
    return apiOk(await updateAcademicYear(actor, id, body), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
