import { requireActor } from "@/server/auth/session";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { ValidationError } from "@/server/errors/application-error";
import { uploadMateriFile } from "@/server/services/materi-file-service";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ materiId: string }> }) {
  const requestId = getRequestId(request.headers);

  try {
    const actor = await requireActor();
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
