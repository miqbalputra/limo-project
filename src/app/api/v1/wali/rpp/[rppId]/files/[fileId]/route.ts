import { requireActor } from "@/server/auth/session";
import { apiError } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { getWaliRppFile } from "@/server/services/rpp-service";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ rppId: string; fileId: string }> }) {
  const requestId = getRequestId(request.headers);
  try {
    const actor = await requireActor();
    const { rppId, fileId } = await params;
    const file = await getWaliRppFile(actor, rppId, fileId);
    return new Response(new Uint8Array(file.bytes), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `attachment; filename="${file.originalName.replace(/["\\\r\n]/g, "_")}"`,
        "Cache-Control": "private, no-store",
        "X-Request-Id": requestId,
      },
    });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
