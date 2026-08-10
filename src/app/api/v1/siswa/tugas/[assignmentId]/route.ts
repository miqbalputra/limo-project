import { requireActor } from "@/server/auth/session";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { getStudentAssignment } from "@/server/services/assignment-service";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ assignmentId: string }> }) {
  const requestId = getRequestId(request.headers);
  try {
    const actor = await requireActor();
    const url = new URL(request.url);
    return apiOk(await getStudentAssignment(actor, (await params).assignmentId, { remedialId: url.searchParams.get("remedialId") || undefined, revisionRequestId: url.searchParams.get("revisionRequestId") || undefined }), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
