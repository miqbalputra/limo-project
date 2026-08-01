import "server-only";
import type { Actor } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { ForbiddenError, NotFoundError } from "@/server/errors/application-error";
import { canAccessStudent, canManageClass } from "@/server/policies/access-policy";
import { getSelectedWaliStudentId } from "@/server/dal/wali-selector-dal";

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

  const selectedStudentId = await getSelectedWaliStudentId(actor);
  const children = await prisma.waliSiswa.findMany({
    where: { endedAt: null, ...(selectedStudentId ? { siswaId: selectedStudentId } : {}), waliProfile: { userId: actor.id } },
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

export type AdminReportPeriod = { from: Date; to: Date; fromValue: string; toValue: string };

export function parseAdminReportPeriod(fromValue?: string, toValue?: string): AdminReportPeriod {
  const now = new Date();
  const fallbackFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const fallbackTo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const from = parseDateOnly(fromValue) ?? fallbackFrom;
  const requestedTo = parseDateOnly(toValue);
  const to = requestedTo ? new Date(Date.UTC(requestedTo.getUTCFullYear(), requestedTo.getUTCMonth(), requestedTo.getUTCDate() + 1)) : fallbackTo;
  const safeFrom = from < to ? from : fallbackFrom;
  const safeTo = from < to ? to : fallbackTo;

  return { from: safeFrom, to: safeTo, fromValue: formatDateOnly(safeFrom), toValue: formatDateOnly(new Date(safeTo.getTime() - 86400000)) };
}

function parseDateOnly(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function formatDateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

export async function getAdminReport(actor: Actor, periodInput?: Partial<AdminReportPeriod>) {
  if (actor.role !== "ADMIN") {
    throw new ForbiddenError();
  }

  const period = parseAdminReportPeriod(periodInput?.fromValue, periodInput?.toValue);
  const [students, classes, presensiRows, progressRows, resultRows, invoices] = await Promise.all([
    prisma.siswa.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, nomorInduk: true, program: { select: { name: true } } },
    }),
    prisma.kelas.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ program: { name: "asc" } }, { name: "asc" }],
      select: { id: true, name: true, program: { select: { name: true } }, level: { select: { name: true } }, guruProfile: { select: { user: { select: { name: true } } } }, enrollments: { where: { status: "ACTIVE" }, select: { siswaId: true } } },
    }),
    prisma.presensi.findMany({
      where: { sesiKelas: { sessionDate: { gte: period.from, lt: period.to } } },
      select: { siswaId: true, status: true, siswa: { select: { name: true, nomorInduk: true } }, sesiKelas: { select: { kelasId: true, kelas: { select: { name: true } } } } },
    }),
    prisma.progresBelajar.findMany({
      where: { sesiKelas: { sessionDate: { gte: period.from, lt: period.to } } },
      select: { siswaId: true, understandingScore: true, siswa: { select: { name: true, nomorInduk: true } }, sesiKelas: { select: { kelasId: true, kelas: { select: { name: true } } } } },
    }),
    prisma.hasilUjian.findMany({
      where: { status: { in: ["FINAL", "CORRECTED"] }, updatedAt: { gte: period.from, lt: period.to } },
      select: { siswaId: true, totalScore: true, siswa: { select: { name: true, nomorInduk: true } }, ujian: { select: { kelasId: true, title: true, kelas: { select: { name: true } } } } },
    }),
    prisma.tagihan.findMany({
      where: { periode: { gte: period.from, lt: period.to } },
      select: { siswaId: true, amount: true, status: true, siswa: { select: { name: true, nomorInduk: true } } },
    }),
  ]);

  const attendancePresent = presensiRows.filter((item) => item.status === "HADIR" || item.status === "TERLAMBAT").length;
  const progressScores = progressRows.map((item) => item.understandingScore);
  const scoreValues = resultRows.map((item) => Number(item.totalScore || 0));
  const invoicePaid = invoices.filter((item) => item.status === "PAID");
  const invoiceOpen = invoices.filter((item) => ["UNPAID", "PENDING", "OVERDUE"].includes(item.status));
  const studentRows = students.map((student) => {
    const attendance = presensiRows.filter((item) => item.siswaId === student.id);
    const progress = progressRows.filter((item) => item.siswaId === student.id).map((item) => item.understandingScore);
    const scores = resultRows.filter((item) => item.siswaId === student.id).map((item) => Number(item.totalScore || 0));
    const studentInvoices = invoices.filter((item) => item.siswaId === student.id);
    const present = attendance.filter((item) => item.status === "HADIR" || item.status === "TERLAMBAT").length;

    return {
      id: student.id,
      name: student.name,
      nomorInduk: student.nomorInduk,
      program: student.program.name,
      attendanceRate: attendance.length ? Math.round((present / attendance.length) * 100) : null,
      attendanceTotal: attendance.length,
      averageProgress: progress.length ? Number((progress.reduce((sum, value) => sum + value, 0) / progress.length).toFixed(1)) : null,
      averageScore: scores.length ? Number((scores.reduce((sum, value) => sum + value, 0) / scores.length).toFixed(1)) : null,
      openInvoiceAmount: studentInvoices.filter((item) => ["UNPAID", "PENDING", "OVERDUE"].includes(item.status)).reduce((sum, item) => sum + Number(item.amount), 0),
    };
  });
  const classRows = classes.map((kelas) => {
    const classAttendance = presensiRows.filter((item) => item.sesiKelas.kelasId === kelas.id);
    const classProgress = progressRows.filter((item) => item.sesiKelas.kelasId === kelas.id).map((item) => item.understandingScore);
    const classScores = resultRows.filter((item) => item.ujian.kelasId === kelas.id).map((item) => Number(item.totalScore || 0));
    const present = classAttendance.filter((item) => item.status === "HADIR" || item.status === "TERLAMBAT").length;

    return {
      id: kelas.id,
      name: kelas.name,
      program: kelas.program.name,
      level: kelas.level.name,
      guru: kelas.guruProfile?.user.name ?? "Belum ditentukan",
      students: kelas.enrollments.length,
      attendanceRate: classAttendance.length ? Math.round((present / classAttendance.length) * 100) : null,
      averageProgress: classProgress.length ? Number((classProgress.reduce((sum, value) => sum + value, 0) / classProgress.length).toFixed(1)) : null,
      averageScore: classScores.length ? Number((classScores.reduce((sum, value) => sum + value, 0) / classScores.length).toFixed(1)) : null,
    };
  });

  return {
    period,
    summary: {
      students: students.length,
      classes: classes.length,
      attendanceTotal: presensiRows.length,
      attendancePresent,
      attendanceRate: presensiRows.length ? Math.round((attendancePresent / presensiRows.length) * 100) : null,
      progressCount: progressRows.length,
      averageProgress: progressScores.length ? Number((progressScores.reduce((sum, value) => sum + value, 0) / progressScores.length).toFixed(1)) : null,
      examCount: resultRows.length,
      averageScore: scoreValues.length ? Number((scoreValues.reduce((sum, value) => sum + value, 0) / scoreValues.length).toFixed(1)) : null,
      invoiceCount: invoices.length,
      invoiceTotal: invoices.reduce((sum, item) => sum + Number(item.amount), 0),
      invoicePaid: invoicePaid.reduce((sum, item) => sum + Number(item.amount), 0),
      invoiceOpen: invoiceOpen.reduce((sum, item) => sum + Number(item.amount), 0),
    },
    classRows,
    studentRows,
  };
}
