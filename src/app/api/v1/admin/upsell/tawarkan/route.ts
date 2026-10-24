import { requireActor, requireRole } from "@/server/auth/session";
import { getEnv } from "@/server/env";
import { ValidationError } from "@/server/errors/application-error";
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
    const parsed = upsellOfferSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new ValidationError("Permintaan tawaran belum valid", parsed.error.flatten().fieldErrors);
    }
    return apiOk(await sendUpsellOffer(actor, parsed.data.siswaId, parsed.data.kelasId), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
