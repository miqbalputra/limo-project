import { requireActor } from "@/server/auth/session";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { listCalendarEvents } from "@/server/services/calendar-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestId = getRequestId(request.headers);
  try {
    const url = new URL(request.url);
    return apiOk(await listCalendarEvents(await requireActor(), { from: url.searchParams.get("from") || undefined, to: url.searchParams.get("to") || undefined }), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
