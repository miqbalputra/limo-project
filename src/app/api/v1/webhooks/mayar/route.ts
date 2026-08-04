import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { processMayarWebhook } from "@/server/services/payment-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = getRequestId(request.headers);

  try {
    const rawBody = await request.text();
    const url = new URL(request.url);
    const secret = request.headers.get("x-mayar-webhook-secret") || url.searchParams.get("secret");
    return apiOk(await processMayarWebhook({ rawBody, secret }), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
