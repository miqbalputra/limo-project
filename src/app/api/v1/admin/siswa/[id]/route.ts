import { requireActor } from "@/server/auth/session";
import { getEnv } from "@/server/env";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { assertSameOrigin } from "@/server/security/origin";
import { archiveSiswa, getSiswa, updateSiswa } from "@/server/services/people-service";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request.headers);
  try {
    const actor = await requireActor();
    return apiOk(await getSiswa(actor, (await params).id), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request.headers);
  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    const actor = await requireActor();
    return apiOk(await updateSiswa(actor, (await params).id, await request.json()), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request.headers);
  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    const actor = await requireActor();
    return apiOk(await archiveSiswa(actor, (await params).id), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
