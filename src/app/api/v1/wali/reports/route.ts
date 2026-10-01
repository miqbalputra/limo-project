import { requireActor, requireRole } from "@/server/auth/session";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { listProgressReports } from "@/server/services/progress-report-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestId = getRequestId(request.headers);

  try {
    const actor = await requireActor();
    requireRole(actor, ["WALI"]);
    const searchParams = new URL(request.url).searchParams;
    return apiOk(
      await listProgressReports(actor, {
        studentId: searchParams.get("studentId") ?? undefined,
        page: Number(searchParams.get("page")) || undefined,
        pageSize: Number(searchParams.get("pageSize")) || undefined,
      }),
      { requestId },
    );
  } catch (error) {
    return apiError(error, { requestId });
  }
}
