import { requireActor } from "@/server/auth/session";
import { getEnv } from "@/server/env";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { assertSameOrigin } from "@/server/security/origin";
import { saveGradeEntry } from "@/server/services/gradebook-service";

export const runtime = "nodejs";

export async function PUT(request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const requestId = getRequestId(request.headers);
  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    return apiOk(await saveGradeEntry(await requireActor(), (await params).itemId, await request.json()), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
