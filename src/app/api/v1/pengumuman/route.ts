import { requireActor } from "@/server/auth/session";
import { getEnv } from "@/server/env";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { assertSameOrigin } from "@/server/security/origin";
import { assertRateLimit, getClientAddress } from "@/server/security/rate-limit";
import { createPengumuman } from "@/server/services/pengumuman-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = getRequestId(request.headers);

  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    const actor = await requireActor();
    assertRateLimit({ key: `pengumuman-create:${actor.id}:${getClientAddress(request.headers)}`, limit: 30, windowMs: 15 * 60 * 1000, message: "Terlalu banyak pengumuman dibuat. Coba lagi nanti" });
    return apiOk(await createPengumuman(actor, await request.json()), { requestId }, { status: 201 });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
