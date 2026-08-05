import { requireActor } from "@/server/auth/session";
import { getEnv } from "@/server/env";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { assertSameOrigin } from "@/server/security/origin";
import { updateRubric, updateRubricStatus } from "@/server/services/rubric-service";

export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: { params: Promise<{ rubricId: string }> }) {
  const requestId = getRequestId(request.headers);
  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    const body = await request.json() as { title?: string; status?: string; criteria?: unknown[] };
    const result = body.criteria || body.title ? await updateRubric(await requireActor(), (await params).rubricId, body) : await updateRubricStatus(await requireActor(), (await params).rubricId, body);
    return apiOk(result, { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
