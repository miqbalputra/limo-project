import "server-only";
import { cookies } from "next/headers";
import type { Actor } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { WALI_ALL_CHILDREN_VALUE, WALI_SELECTED_CHILD_COOKIE } from "@/lib/wali-selector";

export async function listWaliSelectorChildren(actor: Actor) {
  if (actor.role !== "WALI") {
    return [];
  }

  const relations = await prisma.waliSiswa.findMany({
    where: { endedAt: null, waliProfile: { userId: actor.id } },
    orderBy: { siswa: { name: "asc" } },
    select: { siswa: { select: { id: true, name: true, nomorInduk: true } } },
  });

  return relations.map(({ siswa }) => siswa);
}

export async function getSelectedWaliStudentId(actor: Actor) {
  if (actor.role !== "WALI") {
    return null;
  }

  const selectedId = (await cookies()).get(WALI_SELECTED_CHILD_COOKIE)?.value;

  if (!selectedId || selectedId === WALI_ALL_CHILDREN_VALUE) {
    return null;
  }

  const relation = await prisma.waliSiswa.findFirst({
    where: { siswaId: selectedId, endedAt: null, waliProfile: { userId: actor.id } },
    select: { siswaId: true },
  });

  return relation?.siswaId ?? null;
}
