import "server-only";
import type { Prisma } from "@prisma/client";
import type { Actor } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { ForbiddenError } from "@/server/errors/application-error";
import { createPaginationMeta, resolvePagination } from "@/server/pagination";

export type AdminMaterialFileFilters = {
  search?: string;
  kind?: "ALL" | "PDF" | "IMAGE";
  page?: number;
  pageSize?: number;
};

const mimeTypes = {
  PDF: "application/pdf",
  IMAGE: "image/",
} as const;

function requireAdmin(actor: Actor) {
  if (actor.role !== "ADMIN") {
    throw new ForbiddenError();
  }
}

export async function listAdminMaterialFiles(actor: Actor, input: AdminMaterialFileFilters = {}) {
  requireAdmin(actor);

  const pagination = resolvePagination({ page: input.page, pageSize: input.pageSize }, 12);
  const search = input.search?.trim().slice(0, 120) || "";
  const mimeType = input.kind && input.kind !== "ALL" ? mimeTypes[input.kind] : undefined;
  const materialWhere: Prisma.MateriWhereInput = search
    ? {
        OR: [
          { title: { contains: search } },
          { kelas: { name: { contains: search } } },
          { kelas: { program: { name: { contains: search } } } },
        ],
      }
    : {};
  const where: Prisma.FileAssetWhereInput = {
    ownerType: "MATERI",
    deletedAt: null,
    ...(mimeType === "application/pdf" ? { mimeType } : {}),
    ...(mimeType === "image/" ? { mimeType: { startsWith: mimeType } } : {}),
    materi: materialWhere,
  };
  const materialWithFiles: Prisma.MateriWhereInput = { files: { some: { deletedAt: null } } };
  const classWithMaterialFiles: Prisma.KelasWhereInput = { materi: { some: materialWithFiles } };

  const [totalItems, files, totalMaterials, storage, totalFolders, folderRows] = await Promise.all([
    prisma.fileAsset.count({ where }),
    prisma.fileAsset.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.take,
      select: {
        id: true,
        originalName: true,
        mimeType: true,
        sizeBytes: true,
        createdAt: true,
        materi: {
          select: {
            id: true,
            title: true,
            type: true,
            status: true,
            kelas: {
              select: {
                id: true,
                name: true,
                program: { select: { name: true } },
                level: { select: { name: true } },
              },
            },
          },
        },
      },
    }),
    prisma.materi.count({ where: materialWithFiles }),
    prisma.fileAsset.aggregate({ where, _sum: { sizeBytes: true } }),
    prisma.kelas.count({ where: classWithMaterialFiles }),
    prisma.kelas.findMany({
      where: classWithMaterialFiles,
      orderBy: [{ program: { name: "asc" } }, { name: "asc" }],
      take: 6,
      select: {
        id: true,
        name: true,
        program: { select: { name: true } },
        level: { select: { name: true } },
        materi: {
          where: materialWithFiles,
          select: {
            files: { where: { deletedAt: null }, select: { id: true } },
          },
        },
      },
    }),
  ]);

  return {
    items: files.map((file) => ({
      id: file.id,
      originalName: file.originalName,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes.toString(),
      createdAt: file.createdAt.toISOString(),
      materi: file.materi
        ? {
            id: file.materi.id,
            title: file.materi.title,
            type: file.materi.type,
            status: file.materi.status,
            kelas: file.materi.kelas,
          }
        : null,
    })),
    folders: folderRows.map((folder) => ({
      id: folder.id,
      name: folder.name,
      programName: folder.program.name,
      levelName: folder.level.name,
      fileCount: folder.materi.reduce((total, materi) => total + materi.files.length, 0),
    })),
    stats: {
      totalFiles: totalItems,
      totalMaterials,
      totalFolders,
      storageBytes: Number(storage._sum.sizeBytes || 0),
    },
    pagination: createPaginationMeta(pagination.page, pagination.pageSize, totalItems),
  };
}
