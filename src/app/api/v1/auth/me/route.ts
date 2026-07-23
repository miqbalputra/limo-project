import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { getCurrentActor } from "@/server/auth/session";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestId = getRequestId(request.headers);

  try {
    const actor = await getCurrentActor();
    return apiOk({ actor }, { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
