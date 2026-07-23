import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { processPakasirWebhook } from "@/server/services/payment-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const requestId = getRequestId(request.headers);

  try {
    const rawBody = await request.text();
    const result = await processPakasirWebhook({
      rawBody,
      signature: request.headers.get("x-pakasir-signature"),
    });

    return apiOk(result, { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
