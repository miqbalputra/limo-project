import { requireActor } from "@/server/auth/session";
import { getEnv } from "@/server/env";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { assertSameOrigin } from "@/server/security/origin";
import { assertRateLimit, getClientAddress } from "@/server/security/rate-limit";
import { submitAssignment } from "@/server/services/assignment-service";
import { ValidationError } from "@/server/errors/application-error";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ assignmentId: string }> }) {
  const requestId = getRequestId(request.headers);
  try {
    const env = getEnv();
    assertSameOrigin(request.headers, env.APP_URL);
    const actor = await requireActor();
    assertRateLimit({ key: `assignment-submit:${actor.id}:${getClientAddress(request.headers)}`, limit: 30, windowMs: 15 * 60 * 1000, message: "Terlalu banyak submission. Coba lagi nanti" });
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (Number.isFinite(contentLength) && contentLength > env.MAX_ASSIGNMENT_FILE_MB * 1024 * 1024 + 128 * 1024) throw new ValidationError(`Ukuran upload maksimal ${env.MAX_ASSIGNMENT_FILE_MB} MB`);
    const contentType = request.headers.get("content-type") || "";
    let data: Record<string, string>;
    let file: File | null = null;
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const value = formData.get("file");
      file = value instanceof File && value.size > 0 ? value : null;
      data = Object.fromEntries([...formData.entries()].filter(([key]) => key !== "file").map(([key, value]) => [key, String(value)]));
    } else {
      data = await request.json();
    }
    return apiOk(await submitAssignment(actor, (await params).assignmentId, { data, file }), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
