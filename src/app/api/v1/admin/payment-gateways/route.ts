import { requireActor } from "@/server/auth/session";
import { getEnv } from "@/server/env";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { assertSameOrigin } from "@/server/security/origin";
import { listPaymentGatewaySettings, savePaymentGatewaySettings } from "@/server/services/payment-gateway-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestId = getRequestId(request.headers);
  try {
    const actor = await requireActor();
    return apiOk({ items: await listPaymentGatewaySettings(actor) }, { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}

export async function PUT(request: Request) {
  const requestId = getRequestId(request.headers);
  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    const actor = await requireActor();
    return apiOk(await savePaymentGatewaySettings(actor, await request.json()), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
