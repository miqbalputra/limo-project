import { requireActor } from "@/server/auth/session";
import { getEnv } from "@/server/env";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { assertSameOrigin } from "@/server/security/origin";
import { updateAssignment } from "@/server/services/assignment-service";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ assignmentId: string }> }) {
  const requestId = getRequestId(request.headers);
  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    const actor = await requireActor();
    return apiOk(await updateAssignment(actor, (await params).assignmentId, { status: "ARCHIVED" }), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
