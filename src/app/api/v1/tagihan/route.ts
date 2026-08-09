import { requireActor } from "@/server/auth/session";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { resolveWaliChildId } from "@/server/dal/wali-selector-dal";
import { listTagihan } from "@/server/services/billing-service";
import { tagihanStatusSchema } from "@/server/validation/billing";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestId = getRequestId(request.headers);

  try {
    const actor = await requireActor();
    const url = new URL(request.url);
    const selectedChildId = await resolveWaliChildId(actor, url.searchParams.get("anak"));
    const parsedStatus = tagihanStatusSchema.safeParse(url.searchParams.get("status"));
    const search = url.searchParams.get("search")?.trim() || undefined;
    return apiOk(await listTagihan(actor, {}, actor.role === "ADMIN" ? { search, status: parsedStatus.success ? parsedStatus.data : undefined } : {}, selectedChildId), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
