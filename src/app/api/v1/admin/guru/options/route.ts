import { requireActor } from "@/server/auth/session";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { listGuruOptions } from "@/server/services/master-data-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestId = getRequestId(request.headers);

  try {
    const actor = await requireActor();
    const result = await listGuruOptions(actor);
    return apiOk(result, { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
