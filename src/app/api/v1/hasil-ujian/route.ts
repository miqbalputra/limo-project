import { requireActor } from "@/server/auth/session";
import { getEnv } from "@/server/env";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { assertSameOrigin } from "@/server/security/origin";
import { listHasilUjian, submitHasilUjian } from "@/server/services/exam-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestId = getRequestId(request.headers);

  try {
    const actor = await requireActor();
    const searchParams = new URL(request.url).searchParams;
    const pagination = searchParams.has("page") || searchParams.has("pageSize") || searchParams.has("ujianId")
      ? { ujianId: searchParams.get("ujianId") || undefined, page: Number(searchParams.get("page")) || 1, pageSize: Number(searchParams.get("pageSize")) || 20 }
      : undefined;
    return apiOk(await listHasilUjian(actor, pagination), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}

export async function POST(request: Request) {
  const requestId = getRequestId(request.headers);

  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    const actor = await requireActor();
    return apiOk(await submitHasilUjian(actor, await request.json()), { requestId }, { status: 201 });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
