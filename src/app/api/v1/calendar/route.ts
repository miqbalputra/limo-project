import { requireActor } from "@/server/auth/session";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { resolveWaliChildId } from "@/server/dal/wali-selector-dal";
import { listCalendarEvents } from "@/server/services/calendar-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestId = getRequestId(request.headers);
  try {
    const url = new URL(request.url);
    const actor = await requireActor();
    const selectedChildId = await resolveWaliChildId(actor, url.searchParams.get("anak"));
    return apiOk(await listCalendarEvents(actor, { from: url.searchParams.get("from") || undefined, to: url.searchParams.get("to") || undefined, classId: url.searchParams.get("classId") || undefined, siswaId: selectedChildId }), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
