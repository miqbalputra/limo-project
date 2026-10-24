import { requireActor, requireRole } from "@/server/auth/session";
import { getEnv } from "@/server/env";
import { ValidationError } from "@/server/errors/application-error";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { assertSameOrigin } from "@/server/security/origin";
import { currentAutopilotPeriod, generateMonthlyReportDrafts, getReportAutopilotStatus } from "@/server/services/report-autopilot-service";
import { autopilotPeriodSchema } from "@/server/validation/growth";

export async function GET(request: Request) {
  const requestId = getRequestId(request.headers);
  try {
    const actor = await requireActor();
    requireRole(actor, ["ADMIN"]);
    const period = new URL(request.url).searchParams.get("period") || currentAutopilotPeriod();
    return apiOk(await getReportAutopilotStatus(actor, period), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}

export async function POST(request: Request) {
  const requestId = getRequestId(request.headers);
  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    const actor = await requireActor();
    requireRole(actor, ["ADMIN"]);
    const parsed = autopilotPeriodSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new ValidationError("Periode autopilot belum valid", parsed.error.flatten().fieldErrors);
    }
    const period = parsed.data.period || currentAutopilotPeriod();
    return apiOk(await generateMonthlyReportDrafts(actor, { period, dryRun: parsed.data.dryRun }), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
