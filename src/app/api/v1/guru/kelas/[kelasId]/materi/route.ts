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
    const searchParams = new URL(request.url).searchParams;
    const pagination = searchParams.has("page") || searchParams.has("pageSize")
      ? { page: Number(searchParams.get("page")) || 1, pageSize: Number(searchParams.get("pageSize")) || 20 }
      : undefined;
    return apiOk(await listMateri(actor, kelasId, pagination), { requestId });
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
