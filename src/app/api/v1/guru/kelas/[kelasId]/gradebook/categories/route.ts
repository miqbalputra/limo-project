import { requireActor } from "@/server/auth/session";
import { getEnv } from "@/server/env";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { assertSameOrigin } from "@/server/security/origin";
import { createGradeCategory } from "@/server/services/gradebook-service";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ kelasId: string }> }) {
  const requestId = getRequestId(request.headers);
  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    return apiOk(await createGradeCategory(await requireActor(), (await params).kelasId, await request.json()), { requestId }, { status: 201 });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
