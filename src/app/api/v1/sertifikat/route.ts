import { requireActor } from "@/server/auth/session";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { issueSertifikat, listSertifikat } from "@/server/services/certificate-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestId = getRequestId(request.headers);
  try {
    const actor = await requireActor();
    return apiOk(await listSertifikat(actor, Object.fromEntries(new URL(request.url).searchParams)), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}

export async function POST(request: Request) {
  const requestId = getRequestId(request.headers);
  try {
    const actor = await requireActor();
    return apiOk(await issueSertifikat(actor, await request.json()), { requestId }, { status: 201 });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
