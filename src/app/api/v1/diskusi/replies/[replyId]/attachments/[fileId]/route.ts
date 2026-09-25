import { requireActor } from "@/server/auth/session";
import { apiError } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { getDiskusiReplyFile } from "@/server/services/diskusi-service";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ replyId: string; fileId: string }> }) {
  const requestId = getRequestId(request.headers);

  try {
    const actor = await requireActor();
    const { replyId, fileId } = await context.params;
    const file = await getDiskusiReplyFile(actor, replyId, fileId);

    return new Response(new Uint8Array(file.bytes), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `attachment; filename="${file.originalName.replace(/"/g, "")}"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Request-Id": requestId,
      },
    });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
