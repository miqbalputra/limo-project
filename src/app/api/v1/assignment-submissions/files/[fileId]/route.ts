import { NextResponse } from "next/server";
import { requireActor } from "@/server/auth/session";
import { apiError } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { getAuthorizedAssignmentFile } from "@/server/services/assignment-service";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ fileId: string }> }) {
  const requestId = getRequestId(request.headers);
  try {
    const actor = await requireActor();
    const file = await getAuthorizedAssignmentFile(actor, (await params).fileId);
    const filename = encodeURIComponent(file.originalName).replace(/['()]/g, escape);
    const disposition = new URL(request.url).searchParams.get("inline") === "1" ? "inline" : "attachment";
    return new NextResponse(file.bytes, { headers: { "Cache-Control": "private, no-store", "Content-Type": file.mimeType, "Content-Length": String(file.sizeBytes), "Content-Disposition": `${disposition}; filename*=UTF-8''${filename}`, "X-Content-Type-Options": "nosniff", "X-Request-Id": requestId } });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
