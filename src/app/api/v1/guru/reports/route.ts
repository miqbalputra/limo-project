import { requireActor, requireRole } from "@/server/auth/session";
import { getEnv } from "@/server/env";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { assertSameOrigin } from "@/server/security/origin";
import { generateProgressReportDraft, listProgressReports } from "@/server/services/progress-report-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestId = getRequestId(request.headers);

  try {
    const actor = await requireActor();
    requireRole(actor, ["GURU", "ADMIN"]);
    const searchParams = new URL(request.url).searchParams;
    return apiOk(
      await listProgressReports(actor, {
        kelasId: searchParams.get("kelasId") ?? undefined,
        studentId: searchParams.get("studentId") ?? undefined,
        status: searchParams.get("status") ?? undefined,
        page: Number(searchParams.get("page")) || undefined,
        pageSize: Number(searchParams.get("pageSize")) || undefined,
      }),
      { requestId },
    );
  } catch (error) {
    return apiError(error, { requestId });
  }
}

export async function POST(request: Request) {
  const requestId = getRequestId(request.headers);

  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    const actor = await requireActor();
    requireRole(actor, ["GURU", "ADMIN"]);
    return apiOk(await generateProgressReportDraft(actor, await request.json()), { requestId }, { status: 201 });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
