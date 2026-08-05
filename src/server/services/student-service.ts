import "server-only";

import type { Actor } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { ForbiddenError, NotFoundError } from "@/server/errors/application-error";
import { requireFeature } from "@/server/features/feature-flags";
import { listDashboardNotifications } from "@/server/services/notification-service";

async function getStudentContext(actor: Actor) {
  requireFeature("studentPortalEnabled", "Portal Siswa belum diaktifkan");
  if (actor.role !== "SISWA") throw new ForbiddenError("Akses ini hanya tersedia untuk akun siswa");

  const account = await prisma.siswaAccount.findUnique({
    where: { userId: actor.id },
    select: {
      id: true,
      status: true,
      loginIdentifier: true,
      contactEmail: true,
      siswa: {
        select: {
          id: true,
          nomorInduk: true,
          name: true,
          birthAt: true,
          status: true,
          deletedAt: true,
          program: { select: { id: true, name: true, kind: true } },
        },
      },
    },
  });

  if (!account || account.status !== "ACTIVE" || account.siswa.status !== "ACTIVE" || account.siswa.deletedAt) {
    throw new ForbiddenError("Akun siswa belum aktif");
  }

  return account;
}

async function getActiveEnrollmentIds(siswaId: string) {
  return prisma.kelasSiswa.findMany({
    where: { siswaId, status: "ACTIVE", kelas: { status: "ACTIVE" } },
    orderBy: { startDate: "desc" },
    select: {
      id: true,
      startDate: true,
      kelas: {
        select: {
          id: true,
          name: true,
          scheduleNote: true,
          program: { select: { id: true, name: true, kind: true } },
          level: { select: { id: true, name: true } },
        },
      },
    },
  });
}

export async function getStudentDashboard(actor: Actor) {
  const account = await getStudentContext(actor);
  const enrollments = await getActiveEnrollmentIds(account.siswa.id);
  const kelasIds = enrollments.map((enrollment) => enrollment.kelas.id);
  const now = new Date();

  const [sessions, materials, exams, assignments, scores, progress, attendance] = await Promise.all([
    prisma.sesiKelas.findMany({
      where: { kelasId: { in: kelasIds }, sessionDate: { gte: now }, status: { not: "CANCELLED" } },
      orderBy: [{ sessionDate: "asc" }, { meetingNumber: "asc" }],
      take: 5,
      select: { id: true, meetingNumber: true, topic: true, sessionDate: true, status: true, kelas: { select: { id: true, name: true } } },
    }),
    prisma.materi.findMany({
      where: { kelasId: { in: kelasIds }, status: "PUBLISHED" },
      orderBy: [{ updatedAt: "desc" }, { order: "asc" }],
      take: 6,
      select: { id: true, title: true, type: true, updatedAt: true, kelas: { select: { id: true, name: true } } },
    }),
    prisma.ujian.findMany({
      where: {
        kelasId: { in: kelasIds },
        status: "PUBLISHED",
        OR: [{ availableFrom: null }, { availableFrom: { lte: now } }],
        AND: [{ OR: [{ availableUntil: null }, { availableUntil: { gte: now } }] }],
      },
      orderBy: [{ examDate: "asc" }, { createdAt: "desc" }],
      take: 5,
      select: { id: true, title: true, examDate: true, durationMinutes: true, deliveryMode: true, availableUntil: true, kelas: { select: { id: true, name: true } } },
    }),
    prisma.assignment.findMany({
      where: { kelasId: { in: kelasIds }, status: "PUBLISHED", OR: [{ availableFrom: null }, { availableFrom: { lte: now } }] },
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      take: 5,
      select: { id: true, title: true, submissionType: true, maxScore: true, dueAt: true, kelas: { select: { id: true, name: true } }, submissions: { where: { studentId: account.siswa.id }, orderBy: { attemptNumber: "desc" }, take: 1, select: { id: true, status: true, attemptNumber: true } } },
    }),
    prisma.hasilUjian.findMany({
      where: { siswaId: account.siswa.id, status: { in: ["FINAL", "CORRECTED"] } },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, totalScore: true, status: true, updatedAt: true, ujian: { select: { id: true, title: true } } },
    }),
    prisma.progresBelajar.findMany({
      where: { siswaId: account.siswa.id, sesiKelas: { kelasId: { in: kelasIds } } },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, understandingScore: true, category: true, publicNote: true, createdAt: true, sesiKelas: { select: { topic: true, sessionDate: true, kelas: { select: { name: true } } } } },
    }),
    prisma.presensi.findMany({
      where: { siswaId: account.siswa.id, sesiKelas: { kelasId: { in: kelasIds } } },
      select: { status: true },
    }),
  ]);

  const attendedCount = attendance.filter((item) => item.status === "HADIR" || item.status === "TERLAMBAT").length;
  const notifications = await listDashboardNotifications(actor);

  return {
    profile: {
      id: account.siswa.id,
      name: account.siswa.name,
      nomorInduk: account.siswa.nomorInduk,
      birthAt: account.siswa.birthAt,
      program: account.siswa.program,
      loginIdentifier: account.loginIdentifier,
    },
    classes: enrollments,
    schedule: sessions,
    materials,
    assignments: assignments.map((item) => ({ ...item, latestSubmission: item.submissions[0] || null, submissions: undefined })),
    exams,
    scores,
    progress,
    attendance: { total: attendance.length, attended: attendedCount },
    notifications,
  };
}

export async function listStudentClasses(actor: Actor) {
  const account = await getStudentContext(actor);
  return { items: await getActiveEnrollmentIds(account.siswa.id) };
}

export async function getStudentClass(actor: Actor, kelasId: string) {
  const account = await getStudentContext(actor);
  const enrollment = await prisma.kelasSiswa.findFirst({
    where: { siswaId: account.siswa.id, kelasId, status: "ACTIVE", kelas: { status: "ACTIVE" } },
    select: { id: true },
  });
  if (!enrollment) throw new NotFoundError("Kelas tidak ditemukan");

  const [kelas, materials, sessions, exams] = await Promise.all([
    prisma.kelas.findUnique({ where: { id: kelasId }, select: { id: true, name: true, scheduleNote: true, program: { select: { name: true, kind: true } }, level: { select: { name: true } } } }),
    prisma.materi.findMany({ where: { kelasId, status: "PUBLISHED" }, orderBy: [{ order: "asc" }, { updatedAt: "desc" }], select: { id: true, title: true, type: true, content: true, videoUrl: true, updatedAt: true } }),
    prisma.sesiKelas.findMany({ where: { kelasId, status: { not: "CANCELLED" } }, orderBy: { sessionDate: "desc" }, take: 10, select: { id: true, meetingNumber: true, topic: true, sessionDate: true, status: true } }),
    prisma.ujian.findMany({ where: { kelasId, status: "PUBLISHED" }, orderBy: [{ examDate: "asc" }, { createdAt: "desc" }], select: { id: true, title: true, examDate: true, durationMinutes: true, deliveryMode: true } }),
  ]);

  if (!kelas) throw new NotFoundError("Kelas tidak ditemukan");
  return { kelas, materials, sessions, exams };
}

export async function getStudentProfile(actor: Actor) {
  const account = await getStudentContext(actor);
  return {
    item: {
      id: account.siswa.id,
      name: account.siswa.name,
      nomorInduk: account.siswa.nomorInduk,
      birthAt: account.siswa.birthAt,
      status: account.siswa.status,
      program: account.siswa.program,
      loginIdentifier: account.loginIdentifier,
      contactEmail: account.contactEmail,
    },
  };
}
