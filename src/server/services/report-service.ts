import "server-only";
import type { Actor } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { ForbiddenError, NotFoundError } from "@/server/errors/application-error";
import { canAccessStudent, canManageClass } from "@/server/policies/access-policy";

export async function getStudentSummary(actor: Actor, siswaId: string) {
  const allowed = await canAccessStudent(actor, siswaId);

  if (!allowed) {
    throw new ForbiddenError("Anda tidak memiliki akses ke siswa ini");
  }

  const siswa = await prisma.siswa.findUnique({
    where: { id: siswaId },
    select: { id: true, name: true, nomorInduk: true, program: { select: { name: true } } },
  });

  if (!siswa) {
    throw new NotFoundError("Siswa tidak ditemukan");
  }

  const [presensi, presensiRows, progres, hasil] = await Promise.all([
    prisma.presensi.groupBy({
      by: ["status"],
      where: { siswaId },
      _count: { status: true },
    }),
    prisma.presensi.findMany({
      where: { siswaId },
      orderBy: { sesiKelas: { sessionDate: "asc" } },
      select: { status: true, sesiKelas: { select: { sessionDate: true } } },
    }),
    prisma.progresBelajar.findMany({
      where: { siswaId },
      orderBy: { sesiKelas: { sessionDate: "desc" } },
      take: 12,
      select: {
        understandingScore: true,
        publicNote: true,
        category: true,
        sesiKelas: { select: { topic: true, sessionDate: true } },
      },
    }),
    prisma.hasilUjian.findMany({
      where: { siswaId, status: { in: ["FINAL", "CORRECTED"] }, ujian: { showResultToWali: true } },
      orderBy: { updatedAt: "desc" },
      take: 10,
      select: { totalScore: true, status: true, updatedAt: true, ujian: { select: { title: true, examDate: true, durationMinutes: true } } },
    }),
  ]);

  const averageProgress = progres.length > 0
    ? progres.reduce((sum, item) => sum + item.understandingScore, 0) / progres.length
    : null;
  const averageScore = hasil.length > 0
    ? hasil.reduce((sum, item) => sum + Number(item.totalScore || 0), 0) / hasil.length
    : null;
  const monthlyAttendance = Object.values(presensiRows.reduce<Record<string, { month: string; hadir: number; total: number }>>((result, item) => {
    const month = item.sesiKelas.sessionDate.toISOString().slice(0, 7);
    const row = result[month] ||= { month, hadir: 0, total: 0 };
    row.total += 1;
    if (item.status === "HADIR" || item.status === "TERLAMBAT") {
      row.hadir += 1;
    }
    return result;
  }, {}));

  return {
    siswa,
    attendance: Object.fromEntries(presensi.map((item) => [item.status, item._count.status])),
    averageProgress,
    averageScore,
    monthlyAttendance,
    progressTimeline: progres,
    examResults: hasil,
  };
}

export async function getWaliExamHistory(actor: Actor) {
  if (actor.role !== "WALI") {
    throw new ForbiddenError();
  }

  const children = await prisma.waliSiswa.findMany({
    where: { endedAt: null, waliProfile: { userId: actor.id } },
    orderBy: { siswa: { name: "asc" } },
    select: {
      siswa: {
        select: {
          id: true,
          name: true,
          nomorInduk: true,
          status: true,
          program: { select: { name: true } },
          hasilUjian: {
            where: { status: { in: ["FINAL", "CORRECTED"] }, ujian: { showResultToWali: true } },
            orderBy: { updatedAt: "desc" },
            select: {
              id: true,
              status: true,
              totalScore: true,
              finalizedAt: true,
              updatedAt: true,
              ujian: {
                select: {
                  title: true,
                  examDate: true,
                  durationMinutes: true,
                  kelas: { select: { name: true, program: { select: { name: true } } } },
                },
              },
            },
          },
        },
      },
    },
  });

  return { children: children.map((item) => item.siswa) };
}

export async function getClassSummary(actor: Actor, kelasId: string) {
  const allowed = await canManageClass(actor, kelasId);

  if (!allowed) {
    throw new ForbiddenError("Anda tidak memiliki akses ke kelas ini");
  }

  const kelas = await prisma.kelas.findUnique({
    where: { id: kelasId },
    select: { id: true, name: true, program: { select: { name: true } }, level: { select: { name: true } } },
  });

  if (!kelas) {
    throw new NotFoundError("Kelas tidak ditemukan");
  }

  const students = await prisma.kelasSiswa.findMany({
    where: { kelasId, status: "ACTIVE" },
    orderBy: { siswa: { name: "asc" } },
    select: {
      siswa: {
        select: {
          id: true,
          name: true,
          nomorInduk: true,
          presensi: { select: { status: true } },
          progresBelajar: { orderBy: { createdAt: "desc" }, take: 5, select: { understandingScore: true } },
          hasilUjian: { where: { status: { in: ["FINAL", "CORRECTED"] } }, select: { totalScore: true } },
        },
      },
    },
  });

  const rows = students.map(({ siswa }) => {
    const hadir = siswa.presensi.filter((item) => item.status === "HADIR" || item.status === "TERLAMBAT").length;
    const totalPresensi = siswa.presensi.length;
    const averageProgress = siswa.progresBelajar.length
      ? siswa.progresBelajar.reduce((sum, item) => sum + item.understandingScore, 0) / siswa.progresBelajar.length
      : null;
    const averageScore = siswa.hasilUjian.length
      ? siswa.hasilUjian.reduce((sum, item) => sum + Number(item.totalScore || 0), 0) / siswa.hasilUjian.length
      : null;

    const attendanceRate = totalPresensi ? (hadir / totalPresensi) * 100 : null;

    return { id: siswa.id, name: siswa.name, nomorInduk: siswa.nomorInduk, hadir, totalPresensi, attendanceRate, averageProgress, averageScore };
  });

  return { kelas, rows };
}
