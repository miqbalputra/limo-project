import { requireActor } from "@/server/auth/session";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { ValidationError } from "@/server/errors/application-error";
import { getEnv } from "@/server/env";
import { assertSameOrigin } from "@/server/security/origin";
import { assertRateLimit, getClientAddress } from "@/server/security/rate-limit";
import { uploadMateriFile } from "@/server/services/materi-file-service";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ materiId: string }> }) {
  const requestId = getRequestId(request.headers);

  try {
    const env = getEnv();
    assertSameOrigin(request.headers, env.APP_URL);
    const actor = await requireActor();
    assertRateLimit({
      key: `materi-upload:${actor.id}:${getClientAddress(request.headers)}`,
      limit: 20,
      windowMs: 15 * 60 * 1000,
      message: "Terlalu banyak upload materi. Coba lagi nanti",
    });

    const contentLength = Number(request.headers.get("content-length") || 0);
    const maxRequestBytes = env.MAX_MATERIAL_FILE_MB * 1024 * 1024 + 64 * 1024;
    if (Number.isFinite(contentLength) && contentLength > maxRequestBytes) {
      throw new ValidationError(`Ukuran upload maksimal ${env.MAX_MATERIAL_FILE_MB} MB`);
    }

    const { materiId } = await context.params;
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new ValidationError("File materi wajib diunggah");
    }

    return apiOk(await uploadMateriFile(actor, { materiId, file }), { requestId }, { status: 201 });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
