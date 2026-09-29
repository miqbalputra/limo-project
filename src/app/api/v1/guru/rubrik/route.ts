import { requireActorWithRole } from "@/server/auth/session";
import { getEnv } from "@/server/env";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { assertSameOrigin } from "@/server/security/origin";
import { createRubric, listRubrics } from "@/server/services/rubric-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestId = getRequestId(request.headers);
  try {
    return apiOk(await listRubrics(await requireActorWithRole(["ADMIN", "GURU"])), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}

export async function POST(request: Request) {
  const requestId = getRequestId(request.headers);
  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    return apiOk(await createRubric(await requireActorWithRole(["ADMIN", "GURU"]), await request.json()), { requestId }, { status: 201 });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
