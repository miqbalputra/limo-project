import { requireActor } from "@/server/auth/session";
import { getEnv } from "@/server/env";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { assertSameOrigin } from "@/server/security/origin";
import { removeDiskusiAttachment } from "@/server/services/diskusi-service";

export const runtime = "nodejs";

export async function DELETE(request: Request, context: { params: Promise<{ threadId: string; fileId: string }> }) {
  const requestId = getRequestId(request.headers);

  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    const actor = await requireActor();
    const { threadId, fileId } = await context.params;
    return apiOk(await removeDiskusiAttachment(actor, threadId, fileId), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
