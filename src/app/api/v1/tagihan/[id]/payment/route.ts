import { requireActor } from "@/server/auth/session";
import { getEnv } from "@/server/env";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { assertSameOrigin } from "@/server/security/origin";
import { createInvoicePayment } from "@/server/services/payment-service";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request.headers);

  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    const actor = await requireActor();
    const { id } = await context.params;
    return apiOk(await createInvoicePayment(actor, id, await request.json()), { requestId }, { status: 201 });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
