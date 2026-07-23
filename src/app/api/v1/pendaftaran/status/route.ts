import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { lookupPendaftaranStatus } from "@/server/services/pendaftaran-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestId = getRequestId(request.headers);

  try {
    const url = new URL(request.url);
    const result = await lookupPendaftaranStatus(
      {
        kode: url.searchParams.get("kode") || "",
        waliEmail: url.searchParams.get("waliEmail") || "",
      },
      {
        ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
      },
    );

    return apiOk(result, { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
