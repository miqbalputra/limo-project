import "server-only";
import type { Actor } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/errors/application-error";
import { canManageClass } from "@/server/policies/access-policy";
import { createMateriSchema, createSesiKelasSchema } from "@/server/validation/lms";

function parseDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

async function assertCanManageClass(actor: Actor, kelasId: string) {
  const allowed = await canManageClass(actor, kelasId);

  if (!allowed) {
    throw new ForbiddenError("Anda tidak memiliki akses mengelola kelas ini");
  }
}

export async function listMyKelas(actor: Actor) {
  if (actor.role === "ADMIN") {
    const items = await prisma.kelas.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ program: { name: "asc" } }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        program: { select: { name: true } },
        level: { select: { name: true } },
        _count: { select: { sessions: true, materi: true, enrollments: { where: { status: "ACTIVE" } } } },
      },
    });

    return { items };
  }

  if (actor.role !== "GURU") {
    throw new ForbiddenError();
  }

  const items = await prisma.kelas.findMany({
    where: {
      status: "ACTIVE",
      guruProfile: { userId: actor.id },
    },
    orderBy: [{ program: { name: "asc" } }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      program: { select: { name: true } },
      level: { select: { name: true } },
      _count: { select: { sessions: true, materi: true, enrollments: { where: { status: "ACTIVE" } } } },
    },
  });

  return { items };
}

export async function listSesiKelas(actor: Actor, kelasId: string) {
  await assertCanManageClass(actor, kelasId);

  const items = await prisma.sesiKelas.findMany({
    where: { kelasId },
    orderBy: [{ sessionDate: "desc" }, { meetingNumber: "desc" }],
    select: {
      id: true,
      meetingNumber: true,
      topic: true,
      sessionDate: true,
      status: true,
      _count: { select: { presensi: true, progresBelajar: true, materi: true } },
    },
  });

  return { items };
}

export async function createSesiKelas(actor: Actor, input: unknown) {
  const parsed = createSesiKelasSchema.safeParse(input);

  if (!parsed.success) {
    throw new ValidationError("Data sesi kelas belum valid", parsed.error.flatten().fieldErrors);
  }

  await assertCanManageClass(actor, parsed.data.kelasId);

  const item = await prisma.sesiKelas.create({
    data: {
      kelasId: parsed.data.kelasId,
      meetingNumber: parsed.data.meetingNumber,
      topic: parsed.data.topic,
      sessionDate: parseDate(parsed.data.sessionDate),
    },
    select: { id: true, meetingNumber: true, topic: true },
  }).catch((error: unknown) => {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      throw new ConflictError("Nomor pertemuan sudah ada untuk kelas ini");
    }

    throw error;
  });

  await prisma.auditLog.create({
    data: { actorId: actor.id, action: "SESI_KELAS_CREATED", entityType: "SesiKelas", entityId: item.id },
  });

  return { item };
}

export async function listMateri(actor: Actor, kelasId: string) {
  await assertCanManageClass(actor, kelasId);

  const items = await prisma.materi.findMany({
    where: { kelasId },
    orderBy: [{ order: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      type: true,
      status: true,
      language: true,
      direction: true,
      order: true,
      videoUrl: true,
      files: {
        where: { deletedAt: null },
        select: { id: true, originalName: true, mimeType: true },
      },
      sesiKelas: { select: { meetingNumber: true, topic: true } },
      _count: { select: { files: true } },
    },
  });

  return { items };
}

export async function createMateri(actor: Actor, input: unknown) {
  const parsed = createMateriSchema.safeParse(input);

  if (!parsed.success) {
    throw new ValidationError("Data materi belum valid", parsed.error.flatten().fieldErrors);
  }

  await assertCanManageClass(actor, parsed.data.kelasId);

  if (parsed.data.sesiKelasId) {
    const sesi = await prisma.sesiKelas.findFirst({
      where: { id: parsed.data.sesiKelasId, kelasId: parsed.data.kelasId },
      select: { id: true },
    });

    if (!sesi) {
      throw new NotFoundError("Sesi tidak ditemukan untuk kelas ini");
    }
  }

  if (parsed.data.type === "VIDEO_LINK" && !parsed.data.videoUrl) {
    throw new ValidationError("URL video wajib diisi untuk materi video");
  }

  if (parsed.data.type === "TEXT" && !parsed.data.content) {
    throw new ValidationError("Konten teks wajib diisi untuk materi teks");
  }

  if ((parsed.data.type === "PDF" || parsed.data.type === "IMAGE") && (parsed.data.content || parsed.data.videoUrl)) {
    throw new ValidationError("Materi file tidak perlu konten teks atau URL video");
  }

  const item = await prisma.materi.create({
    data: {
      kelasId: parsed.data.kelasId,
      sesiKelasId: parsed.data.sesiKelasId || undefined,
      type: parsed.data.type,
      title: parsed.data.title,
      content: parsed.data.content || undefined,
      videoUrl: parsed.data.videoUrl || undefined,
      language: parsed.data.language || undefined,
      direction: parsed.data.direction || undefined,
      status: parsed.data.status,
      order: parsed.data.order,
      createdById: actor.id,
    },
    select: { id: true, title: true, status: true },
  });

  await prisma.auditLog.create({
    data: { actorId: actor.id, action: "MATERI_CREATED", entityType: "Materi", entityId: item.id },
  });

  return { item };
}
