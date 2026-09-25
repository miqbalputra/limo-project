import { requireActor } from "@/server/auth/session";
import { getEnv } from "@/server/env";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { assertSameOrigin } from "@/server/security/origin";
import { createVoucher, listVouchers } from "@/server/services/voucher-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestId = getRequestId(request.headers);

  try {
    const actor = await requireActor();
    return apiOk(await listVouchers(actor), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}

export async function POST(request: Request) {
  const requestId = getRequestId(request.headers);

  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    const actor = await requireActor();
    return apiOk(await createVoucher(actor, await request.json()), { requestId }, { status: 201 });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
