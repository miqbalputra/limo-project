import { requireActor } from "@/server/auth/session";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { preflightQuizForm } from "@/server/services/quiz-builder-service";

export const runtime = "nodejs";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  const requestId = getRequestId(request.headers);

  try {
    const actor = await requireActor();
    const { id } = await context.params;
    return apiOk(await preflightQuizForm(actor, id), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
