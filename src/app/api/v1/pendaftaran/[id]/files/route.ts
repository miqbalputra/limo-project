import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { ValidationError } from "@/server/errors/application-error";
import { uploadDokumenPendaftaran } from "@/server/services/pendaftaran-file-service";
import { getEnv } from "@/server/env";
import { assertSameOrigin } from "@/server/security/origin";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request.headers);

  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    const { id } = await context.params;
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new ValidationError("File dokumen wajib diunggah");
    }

    const result = await uploadDokumenPendaftaran({
      pendaftaranId: id,
      kode: String(formData.get("kode") || ""),
      waliEmail: String(formData.get("waliEmail") || ""),
      file,
    });

    return apiOk(result, { requestId }, { status: 201 });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
