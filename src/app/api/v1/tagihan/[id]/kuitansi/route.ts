import { NextResponse } from "next/server";
import { requireActor } from "@/server/auth/session";
import { apiError } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { getReceiptPdf } from "@/server/services/receipt-pdf-service";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request.headers);
  try {
    const actor = await requireActor();
    const { id } = await context.params;
    const { buffer, filename } = await getReceiptPdf(actor, id);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
        "X-Request-Id": requestId,
      },
    });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
