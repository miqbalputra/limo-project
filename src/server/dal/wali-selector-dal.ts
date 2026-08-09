import type { Actor } from "../auth/session.ts";
import { prisma } from "../db/prisma.ts";
import { NotFoundError } from "../errors/application-error.ts";
import { WALI_ALL_CHILDREN_VALUE } from "../../lib/wali-selector.ts";

export async function listWaliSelectorChildren(actor: Actor) {
  if (actor.role !== "WALI") {
    return [];
  }

  const relations = await prisma.waliSiswa.findMany({
    where: { endedAt: null, siswa: { status: "ACTIVE", deletedAt: null }, waliProfile: { userId: actor.id } },
    orderBy: { siswa: { name: "asc" } },
    select: { siswa: { select: { id: true, name: true, nomorInduk: true } } },
  });

  return relations.map(({ siswa }) => siswa);
}

export async function resolveWaliChildId(actor: Actor, childId?: string | string[] | null) {
  if (actor.role !== "WALI") {
    return null;
  }

  if (Array.isArray(childId)) {
    throw new NotFoundError("Anak tidak ditemukan");
  }

  const selectedId = childId?.trim();

  if (!selectedId || selectedId === WALI_ALL_CHILDREN_VALUE) {
    return null;
  }

  const relation = await prisma.waliSiswa.findFirst({
    where: { siswaId: selectedId, endedAt: null, siswa: { status: "ACTIVE", deletedAt: null }, waliProfile: { userId: actor.id } },
    select: { siswaId: true },
  });

  if (!relation) {
    throw new NotFoundError("Anak tidak ditemukan");
  }

  return relation.siswaId;
}
