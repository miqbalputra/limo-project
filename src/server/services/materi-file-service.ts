import "server-only";
import type { Actor } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { ForbiddenError, NotFoundError } from "@/server/errors/application-error";
import { canManageClass } from "@/server/policies/access-policy";
import { removePrivateFile, storeMaterialFile } from "@/server/providers/storage/local-storage";

export async function uploadMateriFile(actor: Actor, input: { materiId: string; file: File }) {
  const materi = await prisma.materi.findUnique({
    where: { id: input.materiId },
    select: { id: true, kelasId: true },
  });

  if (!materi) {
    throw new NotFoundError("Materi tidak ditemukan");
  }

  const allowed = await canManageClass(actor, materi.kelasId);

  if (!allowed) {
    throw new ForbiddenError("Anda tidak memiliki akses mengelola materi ini");
  }

  const storedFile = await storeMaterialFile(input.file, `materi/${materi.id}`);

  const asset = await prisma.fileAsset.create({
    data: {
      ownerType: "MATERI",
      ownerId: materi.id,
      materiId: materi.id,
      originalName: storedFile.originalName,
      storedName: storedFile.storedName,
      storagePath: storedFile.storagePath,
      mimeType: storedFile.mimeType,
      sizeBytes: storedFile.sizeBytes,
      checksumSha256: storedFile.checksumSha256,
      visibility: "PRIVATE",
      uploadedById: actor.id,
    },
    select: {
      id: true,
      originalName: true,
      mimeType: true,
      sizeBytes: true,
      createdAt: true,
    },
  }).catch(async (error) => {
    await removePrivateFile(storedFile.storagePath);
    throw error;
  });

  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: "MATERI_FILE_UPLOADED",
      entityType: "Materi",
      entityId: materi.id,
    },
  });

  return { file: { ...asset, sizeBytes: asset.sizeBytes.toString() } };
}
