import { requireActor } from "@/server/auth/session";
import { getEnv } from "@/server/env";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { assertSameOrigin } from "@/server/security/origin";
import { removeDiskusiReplyAttachment } from "@/server/services/diskusi-service";

export const runtime = "nodejs";

export async function DELETE(request: Request, context: { params: Promise<{ replyId: string; fileId: string }> }) {
  const requestId = getRequestId(request.headers);

  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    const actor = await requireActor();
    const { replyId, fileId } = await context.params;
    return apiOk(await removeDiskusiReplyAttachment(actor, replyId, fileId), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
