import { requireActor } from "@/server/auth/session";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { listPendaftaran, parsePendaftaranStatus } from "@/server/services/pendaftaran-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestId = getRequestId(request.headers);

  try {
    const actor = await requireActor();
    const params = new URL(request.url).searchParams;
    const page = Number(params.get("page") ?? "");
    const pageSize = Number(params.get("pageSize") ?? "");
    const search = params.get("search")?.trim() || undefined;
    const status = parsePendaftaranStatus(params.get("status"));

    const result = await listPendaftaran(
      actor,
      {
        ...(Number.isInteger(page) && page > 0 ? { page } : {}),
        ...(Number.isInteger(pageSize) && pageSize > 0 ? { pageSize } : {}),
      },
      { ...(search ? { search } : {}), ...(status ? { status } : {}) },
    );

    return apiOk(result, { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
