import { z } from "zod";
import { requireActor } from "@/server/auth/session";
import { getEnv } from "@/server/env";
import { ValidationError } from "@/server/errors/application-error";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { assertSameOrigin } from "@/server/security/origin";
import { getPaymentGatewayWebhookUrl } from "@/server/services/payment-gateway-service";

export const runtime = "nodejs";

const providerSchema = z.enum(["mayar", "pakasir"]);

export async function POST(request: Request, context: { params: Promise<{ provider: string }> }) {
  const requestId = getRequestId(request.headers);
  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    const actor = await requireActor();
    const { provider } = await context.params;
    const parsed = providerSchema.safeParse(provider);
    if (!parsed.success) return apiError(new ValidationError("Provider payment tidak valid"), { requestId });
    return apiOk({ url: await getPaymentGatewayWebhookUrl(actor, parsed.data) }, { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
