import { requireActor } from "@/server/auth/session";
import { getEnv } from "@/server/env";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { assertSameOrigin } from "@/server/security/origin";
import { createMateri, listMateri } from "@/server/services/lms-service";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ kelasId: string }> }) {
  const requestId = getRequestId(request.headers);

  try {
    const actor = await requireActor();
    const { kelasId } = await context.params;
    return apiOk(await listMateri(actor, kelasId), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}

export async function POST(request: Request, context: { params: Promise<{ kelasId: string }> }) {
  const requestId = getRequestId(request.headers);

  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    const actor = await requireActor();
    const { kelasId } = await context.params;
    return apiOk(await createMateri(actor, { ...(await request.json()), kelasId }), { requestId }, { status: 201 });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
