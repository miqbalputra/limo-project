import { requireActor } from "@/server/auth/session";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { listDiskusiLaporan } from "@/server/services/diskusi-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestId = getRequestId(request.headers);

  try {
    const actor = await requireActor();
    const params = new URL(request.url).searchParams;
    const page = Number(params.get("page") ?? "");
    const pageSize = Number(params.get("pageSize") ?? "");
    const status = params.get("status");

    return apiOk(await listDiskusiLaporan(actor, {
      ...(Number.isInteger(page) && page > 0 ? { page } : {}),
      ...(Number.isInteger(pageSize) && pageSize > 0 ? { pageSize } : {}),
    }, {
      ...(status === "OPEN" || status === "RESOLVED" || status === "DISMISSED" ? { status } : {}),
    }), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
