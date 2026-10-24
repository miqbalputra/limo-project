import { requireActor, requireRole } from "@/server/auth/session";
import { getEnv } from "@/server/env";
import { ValidationError } from "@/server/errors/application-error";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { assertSameOrigin } from "@/server/security/origin";
import { sendRadarIntervensi } from "@/server/services/radar-intelijen-service";
import { radarInterventionSchema } from "@/server/validation/radar";

export async function POST(request: Request) {
  const requestId = getRequestId(request.headers);
  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    const actor = await requireActor();
    requireRole(actor, ["ADMIN"]);
    const parsed = radarInterventionSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new ValidationError("Permintaan intervensi belum valid", parsed.error.flatten().fieldErrors);
    }
    return apiOk(await sendRadarIntervensi(actor, parsed.data.siswaId), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
