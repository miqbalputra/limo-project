import { NextResponse } from "next/server";
import { getRequestId } from "@/server/http/request-id";
import { getQuizMedia } from "@/server/services/quiz-media-service";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request.headers);

  try {
    const { id } = await context.params;
    const media = await getQuizMedia(id);

    return new NextResponse(new Uint8Array(media.bytes), {
      headers: {
        "Content-Type": media.mimeType,
        "Content-Disposition": "inline",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "X-Content-Type-Options": "nosniff",
        "X-Request-Id": requestId,
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
