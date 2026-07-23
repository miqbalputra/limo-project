import "server-only";
import type { Actor } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/errors/application-error";
import { canManageClass } from "@/server/policies/access-policy";
import { submitPresensiSchema, submitProgresSchema } from "@/server/validation/attendance-progress";

async function getManagedSession(actor: Actor, sesiKelasId: string) {
  const sesi = await prisma.sesiKelas.findUnique({
    where: { id: sesiKelasId },
    select: { id: true, kelasId: true, sessionDate: true, topic: true, meetingNumber: true, kelas: { select: { name: true } } },
  });

  if (!sesi) {
    throw new NotFoundError("Sesi kelas tidak ditemukan");
  }

  const allowed = await canManageClass(actor, sesi.kelasId);

  if (!allowed) {
    throw new ForbiddenError("Anda tidak memiliki akses ke sesi ini");
  }

  return sesi;
}

async function getActiveStudentIds(kelasId: string, sessionDate: Date) {
  const enrollments = await prisma.kelasSiswa.findMany({
    where: {
      kelasId,
      status: "ACTIVE",
      startDate: { lte: sessionDate },
      OR: [{ endDate: null }, { endDate: { gte: sessionDate } }],
    },
    select: { siswaId: true },
  });

  return new Set(enrollments.map((item) => item.siswaId));
}

export async function getSessionRoster(actor: Actor, sesiKelasId: string) {
  const sesi = await getManagedSession(actor, sesiKelasId);
  const activeIds = await getActiveStudentIds(sesi.kelasId, sesi.sessionDate);

  const students = await prisma.siswa.findMany({
    where: { id: { in: [...activeIds] }, deletedAt: null },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      nomorInduk: true,
      presensi: { where: { sesiKelasId }, select: { status: true, note: true } },
      progresBelajar: { where: { sesiKelasId }, select: { understandingScore: true, publicNote: true, internalNote: true, category: true } },
    },
  });

  return { sesi, students };
}

export async function submitPresensi(actor: Actor, input: unknown) {
  const parsed = submitPresensiSchema.safeParse(input);

  if (!parsed.success) {
    throw new ValidationError("Data presensi belum valid", parsed.error.flatten().fieldErrors);
  }

  const sesi = await getManagedSession(actor, parsed.data.sesiKelasId);
  const activeIds = await getActiveStudentIds(sesi.kelasId, sesi.sessionDate);

  for (const item of parsed.data.items) {
    if (!activeIds.has(item.siswaId)) {
      throw new ValidationError("Ada siswa yang tidak aktif pada sesi ini");
    }
  }

  await prisma.$transaction([
    ...parsed.data.items.map((item) => prisma.presensi.upsert({
      where: { siswaId_sesiKelasId: { siswaId: item.siswaId, sesiKelasId: parsed.data.sesiKelasId } },
      update: { status: item.status, note: item.note || undefined, updatedById: actor.id },
      create: { siswaId: item.siswaId, sesiKelasId: parsed.data.sesiKelasId, status: item.status, note: item.note || undefined, createdById: actor.id, updatedById: actor.id },
    })),
    prisma.auditLog.create({ data: { actorId: actor.id, action: "PRESENSI_SUBMITTED", entityType: "SesiKelas", entityId: parsed.data.sesiKelasId } }),
  ]);

  return { success: true };
}

export async function submitProgres(actor: Actor, input: unknown) {
  const parsed = submitProgresSchema.safeParse(input);

  if (!parsed.success) {
    throw new ValidationError("Data progres belum valid", parsed.error.flatten().fieldErrors);
  }

  const sesi = await getManagedSession(actor, parsed.data.sesiKelasId);
  const activeIds = await getActiveStudentIds(sesi.kelasId, sesi.sessionDate);

  for (const item of parsed.data.items) {
    if (!activeIds.has(item.siswaId)) {
      throw new ValidationError("Ada siswa yang tidak aktif pada sesi ini");
    }
  }

  await prisma.$transaction([
    ...parsed.data.items.map((item) => prisma.progresBelajar.upsert({
      where: { siswaId_sesiKelasId_category: { siswaId: item.siswaId, sesiKelasId: parsed.data.sesiKelasId, category: item.category || "umum" } },
      update: { understandingScore: item.understandingScore, publicNote: item.publicNote || undefined, internalNote: item.internalNote || undefined },
      create: { siswaId: item.siswaId, sesiKelasId: parsed.data.sesiKelasId, category: item.category || "umum", understandingScore: item.understandingScore, publicNote: item.publicNote || undefined, internalNote: item.internalNote || undefined, createdById: actor.id },
    })),
    prisma.auditLog.create({ data: { actorId: actor.id, action: "PROGRES_SUBMITTED", entityType: "SesiKelas", entityId: parsed.data.sesiKelasId } }),
  ]);

  return { success: true };
}
