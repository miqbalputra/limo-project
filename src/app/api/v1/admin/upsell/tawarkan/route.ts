import { requireActor, requireRole } from "@/server/auth/session";
import { getEnv } from "@/server/env";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { assertSameOrigin } from "@/server/security/origin";
import { sendUpsellOffer } from "@/server/services/upsell-service";
import { upsellOfferSchema } from "@/server/validation/growth";

export async function POST(request: Request) {
  const requestId = getRequestId(request.headers);
  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    const actor = await requireActor();
    requireRole(actor, ["ADMIN"]);
    const parsed = upsellOfferSchema.parse(await request.json());
    return apiOk(await sendUpsellOffer(actor, parsed.siswaId, parsed.kelasId), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
