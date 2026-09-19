import { requireActor } from "@/server/auth/session";
import { apiError } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { createPendaftaranDetailPdf } from "@/server/services/pendaftaran-export-service";
import { getPendaftaranDetail, recordPendaftaranDetailExport } from "@/server/services/pendaftaran-service";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request.headers);

  try {
    const actor = await requireActor();
    const { id } = await context.params;
    const { pendaftaran } = await getPendaftaranDetail(actor, id);
    const pdf = await createPendaftaranDetailPdf(pendaftaran);
    await recordPendaftaranDetailExport(actor, { format: "PDF", id: pendaftaran.id, kode: pendaftaran.kode });

    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="limo-pendaftaran-${pendaftaran.kode}.pdf"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Request-Id": requestId,
      },
    });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
