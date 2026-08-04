import "server-only";
import type { Actor } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/errors/application-error";
import { createKelasSchema, createLevelSchema, createProgramSchema, updateKelasSchema, updateLevelSchema, updateProgramSchema } from "@/server/validation/master-data";

function requireAdmin(actor: Actor) {
  if (actor.role !== "ADMIN") {
    throw new ForbiddenError();
  }
}

export async function listPrograms(actor: Actor) {
  requireAdmin(actor);

  const items = await prisma.program.findMany({
    orderBy: [{ kind: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      kind: true,
      description: true,
      isActive: true,
      _count: {
        select: {
          levels: true,
          kelas: true,
          siswa: true,
        },
      },
    },
  });

  return { items };
}

export async function createProgram(actor: Actor, input: unknown) {
  requireAdmin(actor);
  const parsed = createProgramSchema.safeParse(input);

  if (!parsed.success) {
    throw new ValidationError("Data program belum valid", parsed.error.flatten().fieldErrors);
  }

  const item = await prisma.program.create({
    data: {
      name: parsed.data.name,
      kind: parsed.data.kind,
      description: parsed.data.description || undefined,
    },
    select: { id: true, name: true, kind: true },
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
  requireAdmin(actor);
  const parsed = updateProgramSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Data program belum valid", parsed.error.flatten().fieldErrors);
  const existing = await prisma.program.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new NotFoundError("Program tidak ditemukan");
  const item = await prisma.program.update({ where: { id }, data: { name: parsed.data.name, description: parsed.data.description || null }, select: { id: true, name: true, kind: true, isActive: true } });
  await prisma.auditLog.create({ data: { actorId: actor.id, action: "PROGRAM_UPDATED", entityType: "Program", entityId: id } });
  return { item };
}

export async function archiveProgram(actor: Actor, id: string) {
  requireAdmin(actor);
  const existing = await prisma.program.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new NotFoundError("Program tidak ditemukan");
  const item = await prisma.program.update({ where: { id }, data: { isActive: false }, select: { id: true, name: true, isActive: true } });
  await prisma.auditLog.create({ data: { actorId: actor.id, action: "PROGRAM_ARCHIVED", entityType: "Program", entityId: id } });
  return { item };
}

export async function listLevels(actor: Actor) {
  requireAdmin(actor);

  const items = await prisma.level.findMany({
    orderBy: [{ program: { name: "asc" } }, { order: "asc" }, { name: "asc" }],
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

  return { items };
}

export async function createLevel(actor: Actor, input: unknown) {
  requireAdmin(actor);
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
  requireAdmin(actor);
  const parsed = updateLevelSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Data level belum valid", parsed.error.flatten().fieldErrors);
  const existing = await prisma.level.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new NotFoundError("Level tidak ditemukan");
  const item = await prisma.level.update({ where: { id }, data: { name: parsed.data.name, order: parsed.data.order, description: parsed.data.description || null }, select: { id: true, name: true, order: true, isActive: true } });
  await prisma.auditLog.create({ data: { actorId: actor.id, action: "LEVEL_UPDATED", entityType: "Level", entityId: id } });
  return { item };
}

export async function archiveLevel(actor: Actor, id: string) {
  requireAdmin(actor);
  const existing = await prisma.level.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new NotFoundError("Level tidak ditemukan");
  const item = await prisma.level.update({ where: { id }, data: { isActive: false }, select: { id: true, name: true, isActive: true } });
  await prisma.auditLog.create({ data: { actorId: actor.id, action: "LEVEL_ARCHIVED", entityType: "Level", entityId: id } });
  return { item };
}

export async function listKelas(actor: Actor) {
  requireAdmin(actor);

  const items = await prisma.kelas.findMany({
    orderBy: [{ program: { name: "asc" } }, { level: { order: "asc" } }, { name: "asc" }],
    select: {
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
      _count: { select: { enrollments: { where: { status: "ACTIVE" } } } },
    },
  });

  return { items };
}

export async function createKelas(actor: Actor, input: unknown) {
  requireAdmin(actor);
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
  requireAdmin(actor);
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
  requireAdmin(actor);
  const existing = await prisma.kelas.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new NotFoundError("Kelas tidak ditemukan");
  const item = await prisma.kelas.update({ where: { id }, data: { status: "ARCHIVED" }, select: { id: true, name: true, status: true } });
  await prisma.auditLog.create({ data: { actorId: actor.id, action: "KELAS_ARCHIVED", entityType: "Kelas", entityId: id } });
  return { item };
}

export async function listGuruOptions(actor: Actor) {
  requireAdmin(actor);

  const items = await prisma.guruProfile.findMany({
    orderBy: { user: { name: "asc" } },
    select: {
      id: true,
      user: { select: { name: true, email: true } },
    },
  });

  return { items };
}
