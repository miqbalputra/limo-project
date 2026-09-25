import "server-only";

import type { Actor } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/errors/application-error";
import { assertManageKelasForum, assertViewKelasForum, canManageClass } from "@/server/policies/access-policy";
import { createPaginationMeta, resolvePagination, type PaginationInput } from "@/server/pagination";
import { notifyPengumuman } from "@/server/services/pengumuman-job-service";
import { createPengumumanSchema, updatePengumumanSchema, updatePengumumanStatusSchema } from "@/server/validation/pengumuman";
import { parseInputDate } from "@/server/validation/calendar";

const itemSelect = {
  id: true,
  title: true,
  content: true,
  priority: true,
  audience: true,
  status: true,
  publishAt: true,
  expiresAt: true,
  createdAt: true,
  updatedAt: true,
  kelasId: true,
  kelas: { select: { id: true, name: true, program: { select: { name: true } } } },
  createdBy: { select: { id: true, name: true } },
  _count: { select: { reads: true } },
} as const;

function audienceForRole(actor: Actor) {
  if (actor.role === "SISWA") return ["SISWA" as const, "SEMUA" as const];
  if (actor.role === "WALI") return ["WALI" as const, "SEMUA" as const];
  return ["SISWA" as const, "WALI" as const, "SEMUA" as const];
}

function visibleWhere(actor: Actor) {
  const now = new Date();
  return {
    status: "PUBLISHED" as const,
    audience: { in: audienceForRole(actor) },
    AND: [
      { OR: [{ publishAt: null }, { publishAt: { lte: now } }] },
      { OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] },
    ],
  };
}

async function assertPengumumanVisible(actor: Actor, pengumumanId: string) {
  const item = await prisma.pengumuman.findUnique({
    where: { id: pengumumanId },
    select: { id: true, kelasId: true, status: true, publishAt: true, expiresAt: true, audience: true },
  });

  if (!item) {
    throw new NotFoundError("Pengumuman tidak ditemukan");
  }

  // Pengumuman sekolah-wide (kelasId null) tidak terikat kelas; audiens yang menyeleksi.
  if (item.kelasId) {
    await assertViewKelasForum(actor, item.kelasId);
  }

  const now = new Date();
  const visible = item.status === "PUBLISHED"
    && audienceForRole(actor).includes(item.audience)
    && (!item.publishAt || item.publishAt <= now)
    && (!item.expiresAt || item.expiresAt >= now);

  if (!visible) {
    throw new NotFoundError("Pengumuman tidak ditemukan");
  }

  return item;
}

async function assertCanManagePengumuman(actor: Actor, kelasId: string | null) {
  if (kelasId) {
    await assertManageKelasForum(actor, kelasId);
    return;
  }

  if (actor.role !== "ADMIN") {
    throw new ForbiddenError("Hanya Admin yang dapat mengelola pengumuman sekolah");
  }
}

export async function createPengumuman(actor: Actor, input: unknown) {
  const parsed = createPengumumanSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError("Pengumuman belum valid", parsed.error.flatten().fieldErrors);
  }

  const kelasId = parsed.data.kelasId || null;
  await assertCanManagePengumuman(actor, kelasId);

  const item = await prisma.pengumuman.create({
    data: {
      kelasId,
      title: parsed.data.title,
      content: parsed.data.content,
      priority: parsed.data.priority,
      audience: parsed.data.audience,
      status: parsed.data.status,
      publishAt: parsed.data.publishAt ? parseInputDate(parsed.data.publishAt) : null,
      expiresAt: parsed.data.expiresAt ? parseInputDate(parsed.data.expiresAt) : null,
      createdById: actor.id,
    },
    select: itemSelect,
  });

  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: "PENGUMUMAN_CREATED",
      entityType: "Pengumuman",
      entityId: item.id,
      metadata: { kelasId: item.kelasId, audience: item.audience, priority: item.priority },
    },
  });

  await notifyPengumuman(item.id);

  return { item };
}

export async function updatePengumuman(actor: Actor, pengumumanId: string, input: unknown) {
  const parsed = updatePengumumanSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError("Pengumuman belum valid", parsed.error.flatten().fieldErrors);
  }

  const existing = await prisma.pengumuman.findUnique({
    where: { id: pengumumanId },
    select: { id: true, kelasId: true },
  });
  if (!existing) throw new NotFoundError("Pengumuman tidak ditemukan");

  await assertCanManagePengumuman(actor, existing.kelasId);

  const item = await prisma.pengumuman.update({
    where: { id: pengumumanId },
    data: {
      title: parsed.data.title,
      content: parsed.data.content,
      priority: parsed.data.priority,
      audience: parsed.data.audience,
      publishAt: parsed.data.publishAt ? parseInputDate(parsed.data.publishAt) : null,
      expiresAt: parsed.data.expiresAt ? parseInputDate(parsed.data.expiresAt) : null,
    },
    select: itemSelect,
  });

  await prisma.auditLog.create({
    data: { actorId: actor.id, action: "PENGUMUMAN_UPDATED", entityType: "Pengumuman", entityId: item.id, metadata: { kelasId: existing.kelasId } },
  });

  await notifyPengumuman(item.id);

  return { item };
}

export async function setPengumumanStatus(actor: Actor, pengumumanId: string, input: unknown) {
  const parsed = updatePengumumanStatusSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError("Status pengumuman belum valid", parsed.error.flatten().fieldErrors);
  }

  const existing = await prisma.pengumuman.findUnique({
    where: { id: pengumumanId },
    select: { id: true, kelasId: true },
  });
  if (!existing) throw new NotFoundError("Pengumuman tidak ditemukan");

  await assertCanManagePengumuman(actor, existing.kelasId);

  const item = await prisma.pengumuman.update({
    where: { id: pengumumanId },
    data: { status: parsed.data.status },
    select: itemSelect,
  });

  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: `PENGUMUMAN_${parsed.data.status}`,
      entityType: "Pengumuman",
      entityId: item.id,
      metadata: { kelasId: existing.kelasId },
    },
  });

  await notifyPengumuman(item.id);

  return { item };
}

export async function listPengumuman(actor: Actor, kelasId: string, paginationInput: PaginationInput = {}) {
  const kelas = await prisma.kelas.findUnique({
    where: { id: kelasId },
    select: { id: true, name: true, program: { select: { name: true } }, level: { select: { name: true } } },
  });
  if (!kelas) throw new NotFoundError("Kelas tidak ditemukan");

  await assertViewKelasForum(actor, kelasId);
  const manage = await canManageClass(actor, kelasId);

  const pagination = resolvePagination(paginationInput, 20);
  const where = manage
    ? { kelasId }
    : { OR: [{ kelasId }, { kelasId: null }], ...visibleWhere(actor) };

  const [totalItems, entries] = await Promise.all([
    prisma.pengumuman.count({ where }),
    prisma.pengumuman.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.take,
      select: { ...itemSelect, reads: { where: { userId: actor.id }, take: 1, select: { readAt: true } } },
    }),
  ]);

  const now = new Date();

  return {
    kelas,
    manage,
    items: entries.map((entry) => ({
      ...entry,
      readCount: entry._count.reads,
      isRead: entry.reads.length > 0,
      readAt: entry.reads[0]?.readAt ?? null,
      reads: undefined,
      scheduled: entry.status === "PUBLISHED" && Boolean(entry.publishAt && entry.publishAt > now),
      expired: entry.status === "PUBLISHED" && Boolean(entry.expiresAt && entry.expiresAt < now),
    })),
    pagination: createPaginationMeta(pagination.page, pagination.pageSize, totalItems),
  };
}

export async function listWaliPengumuman(actor: Actor, selectedStudentId: string | null = null, paginationInput: PaginationInput = {}) {
  if (actor.role !== "WALI") throw new ForbiddenError("Hanya untuk akun wali");

  const relations = await prisma.waliSiswa.findMany({
    where: {
      endedAt: null,
      waliProfile: { userId: actor.id },
      siswa: { status: "ACTIVE", deletedAt: null },
      ...(selectedStudentId ? { siswaId: selectedStudentId } : {}),
    },
    select: { siswaId: true },
  });

  const siswaIds = relations.map((relation) => relation.siswaId);
  const pagination = resolvePagination(paginationInput, 20);

  const enrollments = siswaIds.length === 0 ? [] : await prisma.kelasSiswa.findMany({
    where: { siswaId: { in: siswaIds }, status: "ACTIVE", kelas: { status: "ACTIVE" } },
    select: { kelasId: true, kelas: { select: { id: true, name: true, program: { select: { name: true } } } }, siswa: { select: { id: true, name: true } } },
  });
  const kelasIds = [...new Set(enrollments.map((enrollment) => enrollment.kelasId))];

  // Pengumuman sekolah-wide (kelasId null) selalu terlihat, terlepas dari kelas anak.
  const where = { OR: [{ kelasId: { in: kelasIds } }, { kelasId: null }], ...visibleWhere(actor) };
  const [totalItems, entries] = await Promise.all([
    prisma.pengumuman.count({ where }),
    prisma.pengumuman.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.take,
      select: { ...itemSelect, reads: { where: { userId: actor.id }, take: 1, select: { readAt: true } } },
    }),
  ]);

  const childrenByKelas = new Map<string, string[]>();
  for (const enrollment of enrollments) {
    const names = childrenByKelas.get(enrollment.kelasId) ?? [];
    if (!names.includes(enrollment.siswa.name)) names.push(enrollment.siswa.name);
    childrenByKelas.set(enrollment.kelasId, names);
  }

  const now = new Date();

  return {
    items: entries.map((entry) => ({
      ...entry,
      readCount: entry._count.reads,
      isRead: entry.reads.length > 0,
      readAt: entry.reads[0]?.readAt ?? null,
      reads: undefined,
      scheduled: entry.status === "PUBLISHED" && Boolean(entry.publishAt && entry.publishAt > now),
      expired: entry.status === "PUBLISHED" && Boolean(entry.expiresAt && entry.expiresAt < now),
      childNames: entry.kelasId ? childrenByKelas.get(entry.kelasId) ?? [] : [],
    })),
    pagination: createPaginationMeta(pagination.page, pagination.pageSize, totalItems),
  };
}

export async function markPengumumanRead(actor: Actor, pengumumanId: string) {
  const item = await assertPengumumanVisible(actor, pengumumanId);

  await prisma.pengumumanRead.upsert({
    where: { pengumumanId_userId: { pengumumanId: item.id, userId: actor.id } },
    create: { pengumumanId: item.id, userId: actor.id },
    update: {},
  });

  return { success: true, unreadCount: await countUnreadPengumuman(actor) };
}

async function scopedKelasIdsFor(actor: Actor) {
  if (actor.role === "SISWA") {
    const account = await prisma.siswaAccount.findUnique({
      where: { userId: actor.id },
      select: { status: true, siswaId: true, siswa: { select: { status: true, deletedAt: true } } },
    });
    if (!account || account.status !== "ACTIVE" || account.siswa.status !== "ACTIVE" || account.siswa.deletedAt) return [];
    const enrollments = await prisma.kelasSiswa.findMany({
      where: { siswaId: account.siswaId, status: "ACTIVE", kelas: { status: "ACTIVE" } },
      select: { kelasId: true },
    });
    return enrollments.map((enrollment) => enrollment.kelasId);
  }

  if (actor.role === "WALI") {
    const enrollments = await prisma.kelasSiswa.findMany({
      where: { status: "ACTIVE", kelas: { status: "ACTIVE" }, siswa: { status: "ACTIVE", deletedAt: null, waliRelations: { some: { endedAt: null, waliProfile: { userId: actor.id } } } } },
      select: { kelasId: true },
    });
    return [...new Set(enrollments.map((enrollment) => enrollment.kelasId))];
  }

  return [];
}

export async function countUnreadPengumuman(actor: Actor) {
  if (actor.role !== "SISWA" && actor.role !== "WALI") return 0;

  const kelasIds = await scopedKelasIdsFor(actor);

  return prisma.pengumuman.count({
    where: {
      OR: [{ kelasId: { in: kelasIds } }, { kelasId: null }],
      ...visibleWhere(actor),
      reads: { none: { userId: actor.id } },
    },
  });
}

export async function listSchoolPengumuman(actor: Actor, paginationInput: PaginationInput = {}) {
  if (actor.role !== "ADMIN") throw new ForbiddenError("Hanya Admin yang dapat mengelola pengumuman sekolah");

  const pagination = resolvePagination(paginationInput, 20);
  const where = { kelasId: null };
  const [totalItems, entries] = await Promise.all([
    prisma.pengumuman.count({ where }),
    prisma.pengumuman.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: pagination.skip,
      take: pagination.take,
      select: { ...itemSelect, reads: { where: { userId: actor.id }, take: 1, select: { readAt: true } } },
    }),
  ]);

  const now = new Date();

  return {
    items: entries.map((entry) => ({
      ...entry,
      readCount: entry._count.reads,
      isRead: entry.reads.length > 0,
      readAt: entry.reads[0]?.readAt ?? null,
      reads: undefined,
      scheduled: entry.status === "PUBLISHED" && Boolean(entry.publishAt && entry.publishAt > now),
      expired: entry.status === "PUBLISHED" && Boolean(entry.expiresAt && entry.expiresAt < now),
    })),
    pagination: createPaginationMeta(pagination.page, pagination.pageSize, totalItems),
  };
}
