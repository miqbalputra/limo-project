import { NextResponse } from "next/server";
import { requireActor } from "@/server/auth/session";
import { apiError } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { getAuthorizedFile } from "@/server/services/file-service";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request.headers);

  try {
    const actor = await requireActor();
    const { id } = await context.params;
    const { file, bytes } = await getAuthorizedFile(actor, id);
    const filename = encodeURIComponent(file.originalName).replace(/['()]/g, escape);

    return new NextResponse(bytes, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": file.mimeType,
        "Content-Length": String(file.sizeBytes),
        "Content-Disposition": `attachment; filename*=UTF-8''${filename}`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
