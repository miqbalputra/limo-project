import { requireActor } from "@/server/auth/session";
import { apiError } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { getExamAnswerFile } from "@/server/services/exam-service";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string; fileId: string }> };

export async function GET(request: Request, context: Context) {
  const requestId = getRequestId(request.headers);

  try {
    const actor = await requireActor();
    const { id, fileId } = await context.params;
    const media = await getExamAnswerFile(actor, id, fileId);

    return new Response(new Uint8Array(media.bytes), {
      headers: {
        "Content-Type": media.mimeType,
        "Content-Disposition": `attachment; filename="${media.originalName.replace(/"/g, "")}"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Request-Id": requestId,
      },
    });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
