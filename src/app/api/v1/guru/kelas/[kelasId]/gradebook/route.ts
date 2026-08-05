import { requireActor } from "@/server/auth/session";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { getGuruGradebook } from "@/server/services/gradebook-service";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ kelasId: string }> }) {
  const requestId = getRequestId(request.headers);
  try {
    return apiOk(await getGuruGradebook(await requireActor(), (await params).kelasId), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
