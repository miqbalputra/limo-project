import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { listPublicPrograms } from "@/server/services/public-content-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestId = getRequestId(request.headers);
  try { return apiOk({ items: await listPublicPrograms() }, { requestId }); } catch (error) { return apiError(error, { requestId }); }
}
