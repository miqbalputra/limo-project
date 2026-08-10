import { requireActor } from "@/server/auth/session";
import { getAdminReport } from "@/server/services/report-service";
import { createOperationalWorkbook } from "@/server/services/report-export-service";
import { apiError } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestId = getRequestId(request.headers);

  try {
    const actor = await requireActor();
    const url = new URL(request.url);
    const report = await getAdminReport(actor, { fromValue: url.searchParams.get("from") ?? undefined, toValue: url.searchParams.get("to") ?? undefined });
    const workbook = await createOperationalWorkbook(report);
    const filename = `limo-laporan-${report.period.fromValue}-${report.period.toValue}.xlsx`;

    return new Response(workbook, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${filename}"`, "Cache-Control": "no-store", "X-Request-Id": requestId } });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
