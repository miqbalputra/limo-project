import { requireActor } from "@/server/auth/session";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { listWaliOptions } from "@/server/services/people-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestId = getRequestId(request.headers);

  try {
    const actor = await requireActor();
    return apiOk(await listWaliOptions(actor), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
