import "server-only";
import type { Actor } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/errors/application-error";
import { readPrivateFile, storeQuizImageFile } from "@/server/providers/storage/local-storage";

export async function uploadQuizMedia(actor: Actor, file: File | null) {
  if (actor.role !== "GURU" && actor.role !== "ADMIN") {
    throw new ForbiddenError();
  }

  if (!file) {
    throw new ValidationError("File gambar wajib diunggah");
  }

  const stored = await storeQuizImageFile(file, "quiz-media");

  const media = await prisma.quizMedia.create({
    data: {
      originalName: stored.originalName,
      storedName: stored.storedName,
      storagePath: stored.storagePath,
      mimeType: stored.mimeType,
      sizeBytes: stored.sizeBytes,
      createdById: actor.id,
    },
    select: { id: true, mimeType: true, originalName: true },
  });

  return { item: { id: media.id, url: `/api/v1/public/quiz-media/${media.id}`, mimeType: media.mimeType, originalName: media.originalName } };
}

export async function getQuizMedia(id: string) {
  const media = await prisma.quizMedia.findUnique({
    where: { id },
    select: { storagePath: true, mimeType: true, originalName: true },
  });

  if (!media) {
    throw new NotFoundError("Media tidak ditemukan");
  }

  const bytes = await readPrivateFile(media.storagePath);

  return { bytes, mimeType: media.mimeType, originalName: media.originalName };
}
