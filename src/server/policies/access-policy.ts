import "server-only";
import type { UserRole } from "@prisma/client";
import type { Actor } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";

export function canManageUsers(actor: Actor) {
  return actor.role === "ADMIN";
}

export async function canAccessStudent(actor: Actor, siswaId: string) {
  if (actor.role === "ADMIN") {
    return true;
  }

  if (actor.role === "WALI") {
    const relation = await prisma.waliSiswa.findFirst({
      where: {
        siswaId,
        endedAt: null,
        waliProfile: {
          userId: actor.id,
        },
      },
      select: { id: true },
    });

    return Boolean(relation);
  }

  if (actor.role === "GURU") {
    const enrollment = await prisma.kelasSiswa.findFirst({
      where: {
        siswaId,
        status: "ACTIVE",
        kelas: {
          status: "ACTIVE",
          guruProfile: {
            userId: actor.id,
          },
        },
      },
      select: { id: true },
    });

    return Boolean(enrollment);
  }

  return false;
}

export async function canManageClass(actor: Actor, kelasId: string) {
  if (actor.role === "ADMIN") {
    return true;
  }

  if (actor.role !== "GURU") {
    return false;
  }

  const kelas = await prisma.kelas.findFirst({
    where: {
      id: kelasId,
      status: "ACTIVE",
      guruProfile: {
        userId: actor.id,
      },
    },
    select: { id: true },
  });

  return Boolean(kelas);
}

export async function canAccessInvoice(actor: Actor, tagihanId: string) {
  if (actor.role === "ADMIN") {
    return true;
  }

  if (actor.role !== "WALI") {
    return false;
  }

  const tagihan = await prisma.tagihan.findFirst({
    where: {
      id: tagihanId,
      siswa: {
        waliRelations: {
          some: {
            endedAt: null,
            waliProfile: {
              userId: actor.id,
            },
          },
        },
      },
    },
    select: { id: true },
  });

  return Boolean(tagihan);
}

export async function canDownloadFile(actor: Actor, fileId: string) {
  if (actor.role === "ADMIN") {
    return true;
  }

  const file = await prisma.fileAsset.findUnique({
    where: { id: fileId },
    select: {
      ownerType: true,
      ownerId: true,
      pendaftaran: {
        select: {
          waliProfile: {
            select: { userId: true },
          },
        },
      },
      materi: {
        select: {
          status: true,
          kelasId: true,
        },
      },
    },
  });

  if (!file) {
    return false;
  }

  if (file.ownerType === "SISWA") {
    if (actor.role === "GURU") {
      return false;
    }

    return canAccessStudent(actor, file.ownerId);
  }

  if (file.ownerType === "PENDAFTARAN") {
    return file.pendaftaran?.waliProfile?.userId === actor.id;
  }

  if (file.ownerType === "MATERI" && file.materi) {
    if (actor.role === "GURU") {
      return canManageClass(actor, file.materi.kelasId);
    }

    if (actor.role === "WALI" && file.materi.status === "PUBLISHED") {
      const relation = await prisma.kelasSiswa.findFirst({
        where: {
          kelasId: file.materi.kelasId,
          status: "ACTIVE",
          siswa: {
            waliRelations: {
              some: {
                endedAt: null,
                waliProfile: {
                  userId: actor.id,
                },
              },
            },
          },
        },
        select: { id: true },
      });

      return Boolean(relation);
    }
  }

  return false;
}

export function hasRole(actor: Actor, roles: UserRole[]) {
  return roles.includes(actor.role);
}
