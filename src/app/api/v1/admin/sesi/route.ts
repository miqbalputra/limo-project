import { requireActor, requireRole } from "@/server/auth/session";
import { getEnv } from "@/server/env";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { assertSameOrigin } from "@/server/security/origin";
import { createSesiKelas, listSessionWorkspace } from "@/server/services/lms-service";

export const runtime = "nodejs";

const sessionStatuses = new Set(["DRAFT", "FINAL", "CANCELLED"]);

export async function GET(request: Request) {
  const requestId = getRequestId(request.headers);

  try {
    const actor = await requireActor();
    requireRole(actor, ["ADMIN"]);
    const searchParams = new URL(request.url).searchParams;
    const rawStatus = searchParams.get("status") || undefined;
    const status = rawStatus && sessionStatuses.has(rawStatus) ? rawStatus as "DRAFT" | "FINAL" | "CANCELLED" : undefined;
    return apiOk(await listSessionWorkspace(actor, {
      kelasId: searchParams.get("kelasId") || undefined,
      status,
      page: Number(searchParams.get("page")) || 1,
      pageSize: Number(searchParams.get("pageSize")) || 30,
    }), { requestId });
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
    return apiOk(await createSesiKelas(actor, await request.json()), { requestId }, { status: 201 });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
