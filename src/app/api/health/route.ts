import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";

export const runtime = "nodejs";

export function GET(request: Request) {
  const requestId = getRequestId(request.headers);

  try {
    return apiOk(
      {
        status: "ok",
        service: "limo-web",
        timestamp: new Date().toISOString(),
      },
      {
        requestId,
      },
    );
  } catch (error) {
    return apiError(error, { requestId });
  }
}
