import { requireActor } from "@/server/auth/session";
import { apiError } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { exportSiswaCsv } from "@/server/services/people-service";

export async function GET(request: Request) {
  const requestId = getRequestId(request.headers);
  try {
    const actor = await requireActor();
    const csv = await exportSiswaCsv(actor);
    return new Response(csv, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=Data-Siswa-LIMO.csv",
      },
    });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
