import { requireActor } from "@/server/auth/session";
import { getEnv } from "@/server/env";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { assertSameOrigin } from "@/server/security/origin";
import { getPendaftaranDetail, updatePendaftaranContact } from "@/server/services/pendaftaran-service";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  const requestId = getRequestId(request.headers);

  try {
    const actor = await requireActor();
    const { id } = await context.params;
    const result = await getPendaftaranDetail(actor, id);
    return apiOk(result, { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}

export async function PATCH(request: Request, context: Context) {
  const requestId = getRequestId(request.headers);

  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    const { id } = await context.params;
    const body = await request.json();
    return apiOk(await updatePendaftaranContact(await requireActor(), id, body), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
