import { requireActor } from "@/server/auth/session";
import { getEnv } from "@/server/env";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { assertSameOrigin } from "@/server/security/origin";
import { attachDiskusiReplyFile } from "@/server/services/diskusi-service";

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ replyId: string }> }) {
  const requestId = getRequestId(request.headers);

  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    const actor = await requireActor();
    const { replyId } = await context.params;
    const formData = await request.formData();
    const file = formData.get("file");
    return apiOk(await attachDiskusiReplyFile(actor, replyId, file instanceof File ? file : null), { requestId }, { status: 201 });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
