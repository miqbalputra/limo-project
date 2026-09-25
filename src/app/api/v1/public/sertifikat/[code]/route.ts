import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { verifySertifikatByCode } from "@/server/services/certificate-service";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ code: string }> }) {
  const requestId = getRequestId(request.headers);
  try {
    const { code } = await context.params;
    const result = await verifySertifikatByCode(code);
    return apiOk(result, { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
