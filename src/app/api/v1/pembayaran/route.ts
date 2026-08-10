import { requireActor } from "@/server/auth/session";
import { resolveWaliChildId } from "@/server/dal/wali-selector-dal";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { listPaymentLedger } from "@/server/services/billing-service";
import { pembayaranStatusSchema } from "@/server/validation/billing";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestId = getRequestId(request.headers);
  try {
    const actor = await requireActor();
    const searchParams = new URL(request.url).searchParams;
    const parsedStatus = pembayaranStatusSchema.safeParse(searchParams.get("status") || undefined);
    const selectedStudentId = actor.role === "WALI" ? await resolveWaliChildId(actor, searchParams.get("anak")) : null;
    return apiOk(await listPaymentLedger(actor, { page: Number(searchParams.get("page")) || 1, pageSize: Number(searchParams.get("pageSize")) || undefined }, { search: searchParams.get("search") || undefined, status: parsedStatus.success ? parsedStatus.data : undefined }, selectedStudentId), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
