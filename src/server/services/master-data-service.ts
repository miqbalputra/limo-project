import "server-only";
import type { Actor } from "@/server/auth/session";
import { requirePermission } from "@/server/auth/permissions";
import { prisma } from "@/server/db/prisma";
import { NotFoundError, ValidationError } from "@/server/errors/application-error";
import { createPaginationMeta, resolvePagination, type PaginationInput } from "@/server/pagination";
import { createKelasSchema, createLevelSchema, createProgramSchema, updateKelasSchema, updateLevelSchema, updateProgramSchema } from "@/server/validation/master-data";


function parseListFilters(input: unknown) {
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const text = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : undefined);
  const status = text(raw.status);
  const allowedStatus = ["ACTIVE", "INACTIVE", "ARCHIVED"] as const;

  return {
    search: text(raw.search),
    programId: text(raw.programId),
    status: allowedStatus.find((value) => value === status),
  };
}

export async function listPrograms(actor: Actor, input: unknown = {}) {
  await requirePermission(actor, "admin.masterdata.manage");
  const { search } = parseListFilters(input);
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;

  const where = search ? { name: { contains: search } } : undefined;
  const orderBy = [{ kind: "asc" as const }, { name: "asc" as const }];
  const select = {
    id: true,
    name: true,
    kind: true,
    description: true,
    registrationAvailability: true,
    registrationNote: true,
    isActive: true,
    _count: {
      select: {
        levels: true,
        kelas: true,
        siswa: true,
      },
    },
  };

  const pageNumber = Number(raw.page);
  if (!(Number.isInteger(pageNumber) && pageNumber > 0)) {
    const items = await prisma.program.findMany({ where, orderBy, select });
    return { items, pagination: null };
  }

  const pageSize = Number(raw.pageSize);
  const pagination = resolvePagination({ page: pageNumber, ...(Number.isInteger(pageSize) && pageSize > 0 ? { pageSize } : {}) }, 20);
  const totalItems = await prisma.program.count({ where });
  const paginationMeta = createPaginationMeta(pagination.page, pagination.pageSize, totalItems);
  const items = await prisma.program.findMany({
    where,
    orderBy,
    select,
    skip: (paginationMeta.page - 1) * paginationMeta.pageSize,
    take: paginationMeta.pageSize,
  });

  return { items, pagination: paginationMeta };
}

export async function createProgram(actor: Actor, input: unknown) {
  await requirePermission(actor, "admin.masterdata.manage");
  const parsed = createProgramSchema.safeParse(input);

  if (!parsed.success) {
    throw new ValidationError("Data program belum valid", parsed.error.flatten().fieldErrors);
  }

  const item = await prisma.program.create({
    data: {
      name: parsed.data.name,
      kind: parsed.data.kind,
      description: parsed.data.description || undefined,
      registrationAvailability: "OPEN",
    },
    select: { id: true, name: true, kind: true, registrationAvailability: true },
  });

  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: "PROGRAM_CREATED",
      entityType: "Program",
      entityId: item.id,
    },
  });

  return { item };
}

export async function updateProgram(actor: Actor, id: string, input: unknown) {
  await requirePermission(actor, "admin.masterdata.manage");
  const parsed = updateProgramSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Data program belum valid", parsed.error.flatten().fieldErrors);
  const existing = await prisma.program.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new NotFoundError("Program tidak ditemukan");
  const item = await prisma.program.update({ where: { id }, data: { name: parsed.data.name, description: parsed.data.description || null, ...(parsed.data.registrationAvailability ? { registrationAvailability: parsed.data.registrationAvailability } : {}), registrationNote: parsed.data.registrationNote || null }, select: { id: true, name: true, kind: true, isActive: true, registrationAvailability: true, registrationNote: true } });
  await prisma.auditLog.create({ data: { actorId: actor.id, action: "PROGRAM_UPDATED", entityType: "Program", entityId: id } });
  return { item };
}

export async function archiveProgram(actor: Actor, id: string) {
  await requirePermission(actor, "admin.masterdata.manage");
  const existing = await prisma.program.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new NotFoundError("Program tidak ditemukan");
  const item = await prisma.program.update({ where: { id }, data: { isActive: false }, select: { id: true, name: true, isActive: true } });
  await prisma.auditLog.create({ data: { actorId: actor.id, action: "PROGRAM_ARCHIVED", entityType: "Program", entityId: id } });
  return { item };
}

export async function restoreProgram(actor: Actor, id: string) {
  await requirePermission(actor, "admin.masterdata.manage");
  const existing = await prisma.program.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new NotFoundError("Program tidak ditemukan");
  const item = await prisma.program.update({ where: { id }, data: { isActive: true }, select: { id: true, name: true, isActive: true } });
  await prisma.auditLog.create({ data: { actorId: actor.id, action: "PROGRAM_RESTORED", entityType: "Program", entityId: id } });
  return { item };
}

export async function listLevels(actor: Actor, input: unknown = {}) {
  await requirePermission(actor, "admin.masterdata.manage");
  const { search, programId } = parseListFilters(input);
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const paginationInput: PaginationInput = {};
  if (Number.isInteger(Number(raw.page)) && Number(raw.page) > 0) paginationInput.page = Number(raw.page);
  if (Number.isInteger(Number(raw.pageSize)) && Number(raw.pageSize) > 0) paginationInput.pageSize = Number(raw.pageSize);

  const where = {
    ...(search ? { name: { contains: search } } : {}),
    ...(programId ? { programId } : {}),
  };
  const pagination = resolvePagination(paginationInput, 20);
  const totalItems = await prisma.level.count({ where });
  const paginationMeta = createPaginationMeta(pagination.page, pagination.pageSize, totalItems);
  const items = await prisma.level.findMany({
    where,
    orderBy: [{ program: { name: "asc" } }, { order: "asc" }, { name: "asc" }],
    skip: (paginationMeta.page - 1) * paginationMeta.pageSize,
    take: paginationMeta.pageSize,
    select: {
      id: true,
      name: true,
      order: true,
      description: true,
      isActive: true,
      program: { select: { id: true, name: true, kind: true } },
      _count: { select: { kelas: true } },
    },
  });

  return { items, pagination: paginationMeta };
}

export async function createLevel(actor: Actor, input: unknown) {
  await requirePermission(actor, "admin.masterdata.manage");
  const parsed = createLevelSchema.safeParse(input);

  if (!parsed.success) {
    throw new ValidationError("Data level belum valid", parsed.error.flatten().fieldErrors);
  }

  const program = await prisma.program.findUnique({ where: { id: parsed.data.programId }, select: { id: true } });

  if (!program) {
    throw new NotFoundError("Program tidak ditemukan");
  }

  const item = await prisma.level.create({
    data: {
      programId: parsed.data.programId,
      name: parsed.data.name,
      order: parsed.data.order,
      description: parsed.data.description || undefined,
    },
    select: { id: true, name: true, programId: true },
  });

  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: "LEVEL_CREATED",
      entityType: "Level",
      entityId: item.id,
    },
  });

  return { item };
}

export async function updateLevel(actor: Actor, id: string, input: unknown) {
  await requirePermission(actor, "admin.masterdata.manage");
  const parsed = updateLevelSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Data level belum valid", parsed.error.flatten().fieldErrors);
  const existing = await prisma.level.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new NotFoundError("Level tidak ditemukan");
  const item = await prisma.level.update({ where: { id }, data: { name: parsed.data.name, order: parsed.data.order, description: parsed.data.description || null }, select: { id: true, name: true, order: true, isActive: true } });
  await prisma.auditLog.create({ data: { actorId: actor.id, action: "LEVEL_UPDATED", entityType: "Level", entityId: id } });
  return { item };
}

export async function archiveLevel(actor: Actor, id: string) {
  await requirePermission(actor, "admin.masterdata.manage");
  const existing = await prisma.level.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new NotFoundError("Level tidak ditemukan");
  const item = await prisma.level.update({ where: { id }, data: { isActive: false }, select: { id: true, name: true, isActive: true } });
  await prisma.auditLog.create({ data: { actorId: actor.id, action: "LEVEL_ARCHIVED", entityType: "Level", entityId: id } });
  return { item };
}

export async function restoreLevel(actor: Actor, id: string) {
  await requirePermission(actor, "admin.masterdata.manage");
  const existing = await prisma.level.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new NotFoundError("Level tidak ditemukan");
  const item = await prisma.level.update({ where: { id }, data: { isActive: true }, select: { id: true, name: true, isActive: true } });
  await prisma.auditLog.create({ data: { actorId: actor.id, action: "LEVEL_RESTORED", entityType: "Level", entityId: id } });
  return { item };
}

export async function listKelas(actor: Actor, input: unknown = {}) {
  await requirePermission(actor, "admin.masterdata.manage");
  const { search, programId, status } = parseListFilters(input);
  const raw = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;

  const where = {
    ...(search ? { name: { contains: search } } : {}),
    ...(programId ? { programId } : {}),
    ...(status ? { status } : {}),
  };
  const orderBy = [{ program: { name: "asc" as const } }, { level: { order: "asc" as const } }, { name: "asc" as const }];
  const select = {
    id: true,
    name: true,
    status: true,
    scheduleNote: true,
    program: { select: { id: true, name: true, kind: true } },
    level: { select: { id: true, name: true } },
    guruProfile: {
      select: {
        id: true,
        user: { select: { name: true, email: true } },
      },
    },
    _count: { select: { enrollments: { where: { status: "ACTIVE" as const } } } },
  };

  const pageNumber = Number(raw.page);
  if (!(Number.isInteger(pageNumber) && pageNumber > 0)) {
    const items = await prisma.kelas.findMany({ where, orderBy, select });
    return { items, pagination: null };
  }

  const pageSize = Number(raw.pageSize);
  const pagination = resolvePagination({ page: pageNumber, ...(Number.isInteger(pageSize) && pageSize > 0 ? { pageSize } : {}) }, 20);
  const totalItems = await prisma.kelas.count({ where });
  const paginationMeta = createPaginationMeta(pagination.page, pagination.pageSize, totalItems);
  const items = await prisma.kelas.findMany({
    where,
    orderBy,
    select,
    skip: (paginationMeta.page - 1) * paginationMeta.pageSize,
    take: paginationMeta.pageSize,
  });

  return { items, pagination: paginationMeta };
}

export async function createKelas(actor: Actor, input: unknown) {
  await requirePermission(actor, "admin.masterdata.manage");
  const parsed = createKelasSchema.safeParse(input);

  if (!parsed.success) {
    throw new ValidationError("Data kelas belum valid", parsed.error.flatten().fieldErrors);
  }

  const level = await prisma.level.findFirst({
    where: {
      id: parsed.data.levelId,
      programId: parsed.data.programId,
    },
    select: { id: true },
  });

  if (!level) {
    throw new NotFoundError("Level tidak ditemukan untuk program yang dipilih");
  }

  if (parsed.data.guruProfileId) {
    const guru = await prisma.guruProfile.findUnique({
      where: { id: parsed.data.guruProfileId },
      select: { id: true },
    });

    if (!guru) {
      throw new NotFoundError("Guru tidak ditemukan");
    }
  }

  const item = await prisma.kelas.create({
    data: {
      programId: parsed.data.programId,
      levelId: parsed.data.levelId,
      guruProfileId: parsed.data.guruProfileId || undefined,
      name: parsed.data.name,
      scheduleNote: parsed.data.scheduleNote || undefined,
    },
    select: { id: true, name: true },
  });

  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: "KELAS_CREATED",
      entityType: "Kelas",
      entityId: item.id,
    },
  });

  return { item };
}

export async function updateKelas(actor: Actor, id: string, input: unknown) {
  await requirePermission(actor, "admin.masterdata.manage");
  const parsed = updateKelasSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Data kelas belum valid", parsed.error.flatten().fieldErrors);
  const existing = await prisma.kelas.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new NotFoundError("Kelas tidak ditemukan");
  if (parsed.data.guruProfileId) {
    const guru = await prisma.guruProfile.findUnique({ where: { id: parsed.data.guruProfileId }, select: { id: true } });
    if (!guru) throw new NotFoundError("Guru tidak ditemukan");
  }
  const item = await prisma.kelas.update({ where: { id }, data: { name: parsed.data.name, guruProfileId: parsed.data.guruProfileId || null, scheduleNote: parsed.data.scheduleNote || null }, select: { id: true, name: true, status: true } });
  await prisma.auditLog.create({ data: { actorId: actor.id, action: "KELAS_UPDATED", entityType: "Kelas", entityId: id } });
  return { item };
}

export async function archiveKelas(actor: Actor, id: string) {
  await requirePermission(actor, "admin.masterdata.manage");
  const existing = await prisma.kelas.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new NotFoundError("Kelas tidak ditemukan");
  const item = await prisma.kelas.update({ where: { id }, data: { status: "ARCHIVED" }, select: { id: true, name: true, status: true } });
  await prisma.auditLog.create({ data: { actorId: actor.id, action: "KELAS_ARCHIVED", entityType: "Kelas", entityId: id } });
  return { item };
}

export async function restoreKelas(actor: Actor, id: string) {
  await requirePermission(actor, "admin.masterdata.manage");
  const existing = await prisma.kelas.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new NotFoundError("Kelas tidak ditemukan");
  const item = await prisma.kelas.update({ where: { id }, data: { status: "ACTIVE" }, select: { id: true, name: true, status: true } });
  await prisma.auditLog.create({ data: { actorId: actor.id, action: "KELAS_RESTORED", entityType: "Kelas", entityId: id } });
  return { item };
}

export async function listGuruOptions(actor: Actor) {
  await requirePermission(actor, "admin.masterdata.manage");

  const items = await prisma.guruProfile.findMany({
    orderBy: { user: { name: "asc" } },
    select: {
      id: true,
      user: { select: { name: true, email: true } },
    },
  });

  return { items };
}
