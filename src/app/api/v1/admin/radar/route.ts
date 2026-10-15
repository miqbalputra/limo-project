import { requireActor, requireRole } from "@/server/auth/session";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { getRadarIntel } from "@/server/services/radar-intelijen-service";

export async function GET(request: Request) {
  const requestId = getRequestId(request.headers);
  try {
    const actor = await requireActor();
    requireRole(actor, ["ADMIN"]);
    return apiOk(await getRadarIntel(actor), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
