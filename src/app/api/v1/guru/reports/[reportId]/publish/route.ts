import { requireActor, requireRole } from "@/server/auth/session";
import { getEnv } from "@/server/env";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { assertSameOrigin } from "@/server/security/origin";
import { publishProgressReport } from "@/server/services/progress-report-service";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ reportId: string }> }) {
  const requestId = getRequestId(request.headers);

  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    const actor = await requireActor();
    requireRole(actor, ["GURU", "ADMIN"]);
    return apiOk(await publishProgressReport(actor, (await params).reportId), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
