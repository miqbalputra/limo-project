import { requireActor } from "@/server/auth/session";
import { getEnv } from "@/server/env";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { assertSameOrigin } from "@/server/security/origin";
import { updateGradeCategory, updateGradeCategoryStatus } from "@/server/services/gradebook-service";

export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: { params: Promise<{ categoryId: string }> }) {
  const requestId = getRequestId(request.headers);
  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    const body = await request.json() as { status?: string };
    const result = body.status ? await updateGradeCategoryStatus(await requireActor(), (await params).categoryId, body) : await updateGradeCategory(await requireActor(), (await params).categoryId, body);
    return apiOk(result, { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
