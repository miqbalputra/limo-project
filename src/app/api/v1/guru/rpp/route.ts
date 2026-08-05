import { requireActor } from "@/server/auth/session";
import { getEnv } from "@/server/env";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { ValidationError } from "@/server/errors/application-error";
import { assertSameOrigin } from "@/server/security/origin";
import { assertRateLimit, getClientAddress } from "@/server/security/rate-limit";
import { createRpp } from "@/server/services/rpp-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = getRequestId(request.headers);
  try {
    const env = getEnv();
    assertSameOrigin(request.headers, env.APP_URL);
    const actor = await requireActor();
    assertRateLimit({ key: `rpp-create:${actor.id}:${getClientAddress(request.headers)}`, limit: 30, windowMs: 15 * 60 * 1000, message: "Terlalu banyak RPP dibuat. Coba lagi nanti" });
    const contentLength = Number(request.headers.get("content-length") || 0);
    const maxRequestBytes = env.MAX_RPP_FILE_MB * 1024 * 1024 + 128 * 1024;
    if (Number.isFinite(contentLength) && contentLength > maxRequestBytes) throw new ValidationError(`Ukuran upload maksimal ${env.MAX_RPP_FILE_MB} MB`);

    const formData = await request.formData();
    const fileValue = formData.get("file");
    const file = fileValue instanceof File && fileValue.size > 0 ? fileValue : null;
    const data = Object.fromEntries([...formData.entries()].filter(([key]) => key !== "file").map(([key, value]) => [key, String(value)]));
    return apiOk(await createRpp(actor, { data, file }), { requestId }, { status: 201 });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
