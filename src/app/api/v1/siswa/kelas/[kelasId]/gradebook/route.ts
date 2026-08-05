import { requireActor } from "@/server/auth/session";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { getStudentGradebook } from "@/server/services/gradebook-service";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ kelasId: string }> }) {
  const requestId = getRequestId(request.headers);
  try {
    return apiOk(await getStudentGradebook(await requireActor(), (await params).kelasId), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
