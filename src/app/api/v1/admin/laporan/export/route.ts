import { requireActor } from "@/server/auth/session";
import { getAdminReport } from "@/server/services/report-service";
import { apiError } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";

export const runtime = "nodejs";

function csvCell(value: string | number | null) {
  const raw = String(value ?? "");
  const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  const requestId = getRequestId(request.headers);

  try {
    const actor = await requireActor();
    const url = new URL(request.url);
    const report = await getAdminReport(actor, { fromValue: url.searchParams.get("from") ?? undefined, toValue: url.searchParams.get("to") ?? undefined });
    const lines = [
      ["Laporan Operasional LIMO", `${report.period.fromValue} sampai ${report.period.toValue}`],
      [],
      ["Siswa", "Nomor Induk", "Program", "Kehadiran", "Total Presensi", "Rata-rata Progres", "Rata-rata Nilai", "Tagihan Terbuka"],
      ...report.studentRows.map((row) => [row.name, row.nomorInduk, row.program, row.attendanceRate === null ? "" : `${row.attendanceRate}%`, row.attendanceTotal, row.averageProgress ?? "", row.averageScore ?? "", row.openInvoiceAmount]),
    ].map((row) => row.map((value) => csvCell(value as string | number | null)).join(","));
    const body = `\ufeff${lines.join("\r\n")}\r\n`;

    return new Response(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="limo-laporan-${report.period.fromValue}-${report.period.toValue}.csv"`, "Cache-Control": "no-store", "X-Request-Id": requestId } });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
