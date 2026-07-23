import "server-only";
import type { Actor } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { ForbiddenError, NotFoundError } from "@/server/errors/application-error";
import { canDownloadFile } from "@/server/policies/access-policy";
import { readPrivateFile } from "@/server/providers/storage/local-storage";

export async function getAuthorizedFile(actor: Actor, fileId: string) {
  const allowed = await canDownloadFile(actor, fileId);

  if (!allowed) {
    throw new ForbiddenError("Anda tidak memiliki akses ke file ini");
  }

  const file = await prisma.fileAsset.findFirst({
    where: {
      id: fileId,
      deletedAt: null,
    },
    select: {
      id: true,
      originalName: true,
      storagePath: true,
      mimeType: true,
      sizeBytes: true,
    },
  });

  if (!file) {
    throw new NotFoundError("File tidak ditemukan");
  }

  const bytes = await readPrivateFile(file.storagePath);

  return { file, bytes };
}
