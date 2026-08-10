import { requireActor } from "@/server/auth/session";
import { apiError } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { createPendaftaranWorkbook } from "@/server/services/pendaftaran-export-service";
import { getPendaftaranExportData, parsePendaftaranStatus, recordPendaftaranExport } from "@/server/services/pendaftaran-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestId = getRequestId(request.headers);

  try {
    const actor = await requireActor();
    const url = new URL(request.url);
    const filters = {
      search: url.searchParams.get("search")?.trim().slice(0, 120) || undefined,
      status: parsePendaftaranStatus(url.searchParams.get("status")),
    };
    const data = await getPendaftaranExportData(actor, filters);
    const workbook = await createPendaftaranWorkbook({ data, filters });
    await recordPendaftaranExport(actor, { format: "XLSX", filters, rowCount: data.items.length, truncated: data.truncated });
    const filename = `limo-pendaftaran-${new Date().toISOString().slice(0, 10)}.xlsx`;

    return new Response(workbook, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Request-Id": requestId,
      },
    });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
