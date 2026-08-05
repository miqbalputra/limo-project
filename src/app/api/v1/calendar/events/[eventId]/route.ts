import { requireActor } from "@/server/auth/session";
import { getEnv } from "@/server/env";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { assertSameOrigin } from "@/server/security/origin";
import { deleteCalendarEvent, updateCalendarEvent } from "@/server/services/calendar-service";

export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const requestId = getRequestId(request.headers);
  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    return apiOk(await updateCalendarEvent(await requireActor(), (await params).eventId, await request.json()), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const requestId = getRequestId(request.headers);
  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    return apiOk(await deleteCalendarEvent(await requireActor(), (await params).eventId), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
