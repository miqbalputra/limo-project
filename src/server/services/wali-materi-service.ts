import "server-only";
import type { Actor } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { ForbiddenError, NotFoundError } from "@/server/errors/application-error";
import { getSelectedWaliStudentId } from "@/server/dal/wali-selector-dal";
import { readPrivateFile } from "@/server/providers/storage/local-storage";

async function getAllowedStudentIds(actor: Actor) {
  if (actor.role !== "WALI") {
    throw new ForbiddenError();
  }

  const selectedStudentId = await getSelectedWaliStudentId(actor);
  const relations = await prisma.waliSiswa.findMany({
    where: { endedAt: null, ...(selectedStudentId ? { siswaId: selectedStudentId } : {}), waliProfile: { userId: actor.id } },
    select: { siswaId: true },
  });

  return relations.map((relation) => relation.siswaId);
}

function publishedMaterialWhere(studentIds: string[]) {
  return {
    status: "PUBLISHED" as const,
    kelas: { enrollments: { some: { status: "ACTIVE" as const, siswaId: { in: studentIds } } } },
  };
}

export async function listWaliMateri(actor: Actor) {
  const studentIds = await getAllowedStudentIds(actor);

  if (studentIds.length === 0) {
    return { items: [] };
  }

  const items = await prisma.materi.findMany({
    where: publishedMaterialWhere(studentIds),
    orderBy: [{ kelas: { name: "asc" } }, { order: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      content: true,
      videoUrl: true,
      language: true,
      direction: true,
      files: { where: { deletedAt: null }, select: { id: true, originalName: true, mimeType: true, sizeBytes: true } },
      kelas: { select: { id: true, name: true, program: { select: { name: true } }, level: { select: { name: true } } } },
      sesiKelas: { select: { meetingNumber: true, topic: true, sessionDate: true } },
    },
  });

  return { items: items.map((item) => ({ ...item, files: item.files.map((file) => ({ ...file, sizeBytes: file.sizeBytes.toString() })) })) };
}

export async function getWaliMateriFile(actor: Actor, materiId: string, fileId: string) {
  const studentIds = await getAllowedStudentIds(actor);

  if (studentIds.length === 0) {
    throw new NotFoundError("File materi tidak ditemukan");
  }

  const file = await prisma.fileAsset.findFirst({
    where: { id: fileId, materiId, deletedAt: null, materi: publishedMaterialWhere(studentIds) },
    select: { originalName: true, mimeType: true, storagePath: true },
  });

  if (!file) {
    throw new NotFoundError("File materi tidak ditemukan");
  }

  return { ...file, bytes: await readPrivateFile(file.storagePath) };
}
