import "server-only";
import type { Actor } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { ForbiddenError, NotFoundError } from "@/server/errors/application-error";
import { readPrivateFile } from "@/server/providers/storage/local-storage";
import { createPaginationMeta, resolvePagination, type PaginationInput } from "@/server/pagination";

async function getAllowedStudentIds(actor: Actor, selectedStudentId: string | null = null) {
  if (actor.role !== "WALI") {
    throw new ForbiddenError();
  }

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

export async function listWaliMateri(actor: Actor, selectedStudentId: string | null = null, paginationInput: PaginationInput = {}) {
  const studentIds = await getAllowedStudentIds(actor, selectedStudentId);

  if (studentIds.length === 0) {
    return { items: [], pagination: createPaginationMeta(1, 20, 0), stats: { total: 0, text: 0, video: 0, files: 0 } };
  }

  const where = publishedMaterialWhere(studentIds);
  const pagination = resolvePagination(paginationInput, 20);
  const [total, typeCounts, fileCount] = await Promise.all([
    prisma.materi.count({ where }),
    prisma.materi.groupBy({ by: ["type"], where, _count: { _all: true } }),
    prisma.fileAsset.count({ where: { deletedAt: null, materi: where } }),
  ]);
  const items = await prisma.materi.findMany({
    where,
    orderBy: [{ kelas: { name: "asc" } }, { order: "asc" }, { createdAt: "desc" }],
    skip: pagination.skip,
    take: pagination.take,
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
      kelas: {
        select: {
          id: true,
          name: true,
          program: { select: { name: true } },
          level: { select: { name: true } },
          enrollments: {
            where: { status: "ACTIVE", siswaId: { in: studentIds } },
            select: { siswa: { select: { id: true, name: true, nomorInduk: true } } },
          },
        },
      },
      sesiKelas: { select: { meetingNumber: true, topic: true, sessionDate: true } },
    },
  });

  const text = typeCounts.find((row) => row.type === "TEXT")?._count._all ?? 0;
  const video = typeCounts.find((row) => row.type === "VIDEO_LINK")?._count._all ?? 0;

  return {
    items: items.map((item) => ({ ...item, files: item.files.map((file) => ({ ...file, sizeBytes: file.sizeBytes.toString() })) })),
    pagination: createPaginationMeta(pagination.page, pagination.pageSize, total),
    stats: { total, text, video, files: fileCount },
  };
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
