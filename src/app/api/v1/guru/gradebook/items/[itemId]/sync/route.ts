import { requireActor } from "@/server/auth/session";
import { getEnv } from "@/server/env";
import { apiError, apiOk } from "@/server/http/api-response";
import { getRequestId } from "@/server/http/request-id";
import { assertSameOrigin } from "@/server/security/origin";
import { canManageClass } from "@/server/policies/access-policy";
import { requireFeature } from "@/server/features/feature-flags";
import { prisma } from "@/server/db/prisma";
import { syncGradeItemById } from "@/server/services/gradebook-service";
import { ForbiddenError, NotFoundError } from "@/server/errors/application-error";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const requestId = getRequestId(request.headers);
  try {
    assertSameOrigin(request.headers, getEnv().APP_URL);
    requireFeature("gradebookEnabled", "Gradebook belum diaktifkan");
    const actor = await requireActor();
    if (actor.role !== "GURU") throw new ForbiddenError();
    const item = await prisma.gradeItem.findUnique({ where: { id: (await params).itemId }, select: { id: true, classId: true } });
    if (!item) throw new NotFoundError("Item gradebook tidak ditemukan");
    if (!(await canManageClass(actor, item.classId))) throw new ForbiddenError("Anda tidak memiliki akses ke gradebook kelas ini");
    return apiOk(await syncGradeItemById(item.id), { requestId });
  } catch (error) {
    return apiError(error, { requestId });
  }
}
