import { requireActor } from "@/server/auth/session";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { listUsers } from "@/server/services/auth-service";

export async function GET(request: Request) {
  const requestId = getRequestId(request.headers);
  try {
    return apiOk(await listUsers(await requireActor()), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
