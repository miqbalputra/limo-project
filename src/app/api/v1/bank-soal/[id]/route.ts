import { requireActor, requireRole } from "@/server/auth/session";
import { getEnv } from "@/server/env";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { assertSameOrigin } from "@/server/security/origin";
import { deleteBankSoal, getBankSoal, updateBankSoal } from "@/server/services/exam-service";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request.headers);
  try {
    const actor = await requireActor();
    requireRole(actor, ["ADMIN", "GURU"]);
    const { id } = await params;
    return apiOk(await getBankSoal(actor, id), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request.headers);
  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    const actor = await requireActor();
    requireRole(actor, ["ADMIN", "GURU"]);
    const { id } = await params;
    return apiOk(await updateBankSoal(actor, id, await request.json()), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId(request.headers);
  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    const actor = await requireActor();
    requireRole(actor, ["ADMIN", "GURU"]);
    const { id } = await params;
    return apiOk(await deleteBankSoal(actor, id), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
