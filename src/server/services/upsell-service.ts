import "server-only";

import { requirePermission } from "@/server/auth/permissions";
import type { Actor } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { NotFoundError, ValidationError } from "@/server/errors/application-error";
import { notifyWaliForStudents } from "./notification-service";

export type UpsellReadiness = {
  moduleProgress: number | null;
  averageScore: number | null;
  attendanceRate: number | null;
  score: number;
};

export type UpsellOpportunityRow = {
  siswaId: string;
  kelasId: string;
  nomorInduk: string;
  name: string;
  program: string;
  kelasName: string;
  currentLevel: string;
  nextLevel: string | null;
  readiness: UpsellReadiness;
  eligible: boolean;
  reasons: string[];
};

export type UpsellSummary = {
  generatedAt: string;
  scannedEnrollments: number;
  eligibleCount: number;
  programsCovered: string[];
  opportunities: UpsellOpportunityRow[];
};

const MODULE_WEIGHT = 0.4;
const EXAM_WEIGHT = 0.4;
const ATTENDANCE_WEIGHT = 0.2;

/** Ambang kesiapan: progres modul >= 75, nilai rata-rata >= 70 (bila ada), kehadiran >= 80 (bila ada). */
const MODULE_THRESHOLD = 75;
const EXAM_THRESHOLD = 70;
const ATTENDANCE_THRESHOLD = 80;

function average(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function computeReadiness(moduleProgress: number | null, averageScore: number | null, attendanceRate: number | null): UpsellReadiness {
  const parts: Array<{ value: number; weight: number }> = [];
  if (moduleProgress !== null) parts.push({ value: moduleProgress, weight: MODULE_WEIGHT });
  if (averageScore !== null) parts.push({ value: averageScore, weight: EXAM_WEIGHT });
  if (attendanceRate !== null) parts.push({ value: attendanceRate, weight: ATTENDANCE_WEIGHT });

  const totalWeight = parts.reduce((total, part) => total + part.weight, 0);
  const score = totalWeight === 0 ? 0 : Math.round((parts.reduce((total, part) => total + part.value * part.weight, 0) / totalWeight) * 10) / 10;

  return { moduleProgress, averageScore, attendanceRate, score };
}

function nextLevelName(levels: Array<{ id: string; name: string; order: number }>, currentLevelId: string) {
  const current = levels.find((level) => level.id === currentLevelId);
  if (!current) return null;
  const next = levels
    .filter((level) => level.order > current.order)
    .sort((a, b) => a.order - b.order)
    .at(0);
  return next?.name ?? null;
}

export async function getUpsellOpportunities(actor: Actor): Promise<UpsellSummary> {
  await requirePermission(actor, "admin.upsell.view");

  const enrollments = await prisma.kelasSiswa.findMany({
    where: { status: "ACTIVE", kelas: { status: "ACTIVE" }, siswa: { status: "ACTIVE", deletedAt: null } },
    select: {
      siswaId: true,
      kelasId: true,
      kelas: {
        select: {
          id: true,
          name: true,
          program: { select: { name: true, levels: { where: { isActive: true }, select: { id: true, name: true, order: true } } } },
          level: { select: { id: true, name: true } },
        },
      },
      siswa: { select: { id: true, nomorInduk: true, name: true } },
    },
  });

  if (enrollments.length === 0) {
    return { generatedAt: new Date().toISOString(), scannedEnrollments: 0, eligibleCount: 0, programsCovered: [], opportunities: [] };
  }

  const siswaIds = [...new Set(enrollments.map((enrollment) => enrollment.siswaId))];
  const kelasIds = [...new Set(enrollments.map((enrollment) => enrollment.kelasId))];

  const [moduleRows, examRows, presensiRows] = await Promise.all([
    prisma.studentModuleProgress.findMany({
      where: { studentId: { in: siswaIds }, module: { kelasId: { in: kelasIds }, status: "PUBLISHED" } },
      select: { studentId: true, moduleId: true, module: { select: { kelasId: true } }, progressPercentage: true },
    }),
    prisma.hasilUjian.findMany({
      where: { siswaId: { in: siswaIds }, ujian: { kelasId: { in: kelasIds } }, status: { in: ["FINAL", "CORRECTED"] }, releasedAt: { not: null } },
      select: { siswaId: true, totalScore: true, ujian: { select: { kelasId: true } } },
    }),
    prisma.presensi.findMany({
      where: { siswaId: { in: siswaIds }, sesiKelas: { kelasId: { in: kelasIds } } },
      select: { siswaId: true, status: true, sesiKelas: { select: { kelasId: true } } },
    }),
  ]);

  const moduleAgg = new Map<string, number[]>();
  for (const row of moduleRows) {
    const key = `${row.studentId}:${row.module.kelasId}`;
    const list = moduleAgg.get(key) ?? [];
    list.push(Number(row.progressPercentage));
    moduleAgg.set(key, list);
  }

  const examAgg = new Map<string, number[]>();
  for (const row of examRows) {
    if (row.totalScore === null) continue;
    const value = Number(row.totalScore);
    if (!Number.isFinite(value)) continue;
    const key = `${row.siswaId}:${row.ujian.kelasId}`;
    const list = examAgg.get(key) ?? [];
    list.push(value);
    examAgg.set(key, list);
  }

  const attendanceAgg = new Map<string, { total: number; present: number }>();
  for (const row of presensiRows) {
    const key = `${row.siswaId}:${row.sesiKelas.kelasId}`;
    const agg = attendanceAgg.get(key) ?? { total: 0, present: 0 };
    agg.total += 1;
    if (row.status === "HADIR" || row.status === "TERLAMBAT") agg.present += 1;
    attendanceAgg.set(key, agg);
  }

  const opportunities: UpsellOpportunityRow[] = [];
  const programsCovered = new Set<string>();

  for (const enrollment of enrollments) {
    const key = `${enrollment.siswaId}:${enrollment.kelasId}`;
    const moduleProgress = average(moduleAgg.get(key) ?? []);
    const averageScore = average(examAgg.get(key) ?? []);
    const attendance = attendanceAgg.get(key);
    const attendanceRate = attendance && attendance.total > 0 ? Math.round((attendance.present / attendance.total) * 100) : null;

    const readiness = computeReadiness(moduleProgress, averageScore, attendanceRate);
    const nextLevel = nextLevelName(enrollment.kelas.program.levels, enrollment.kelas.level.id);

    const reasons: string[] = [];
    if (moduleProgress !== null && moduleProgress < MODULE_THRESHOLD) reasons.push(`Progres modul ${round1(moduleProgress)}% (butuh >= ${MODULE_THRESHOLD}%)`);
    if (averageScore !== null && averageScore < EXAM_THRESHOLD) reasons.push(`Rata-rata nilai ${round1(averageScore)} (butuh >= ${EXAM_THRESHOLD})`);
    if (attendanceRate !== null && attendanceRate < ATTENDANCE_THRESHOLD) reasons.push(`Kehadiran ${attendanceRate}% (butuh >= ${ATTENDANCE_THRESHOLD}%)`);

    const eligible = reasons.length === 0 && moduleProgress !== null;
    if (eligible) programsCovered.add(enrollment.kelas.program.name);

    opportunities.push({
      siswaId: enrollment.siswaId,
      kelasId: enrollment.kelasId,
      nomorInduk: enrollment.siswa.nomorInduk,
      name: enrollment.siswa.name,
      program: enrollment.kelas.program.name,
      kelasName: enrollment.kelas.name,
      currentLevel: enrollment.kelas.level.name,
      nextLevel,
      readiness,
      eligible,
      reasons,
    });
  }

  const eligibleRows = opportunities
    .filter((row) => row.eligible)
    .sort((a, b) => b.readiness.score - a.readiness.score || a.name.localeCompare(b.name));

  return {
    generatedAt: new Date().toISOString(),
    scannedEnrollments: enrollments.length,
    eligibleCount: eligibleRows.length,
    programsCovered: [...programsCovered].sort(),
    opportunities: eligibleRows,
  };
}

export async function sendUpsellOffer(actor: Actor, siswaId: string, kelasId: string) {
  await requirePermission(actor, "admin.upsell.view");

  const summary = await getUpsellOpportunities(actor);
  const row = summary.opportunities.find((item) => item.siswaId === siswaId && item.kelasId === kelasId);
  if (!row) {
    throw new NotFoundError("Siswa belum memenuhi kriteria peluang kenaikan level");
  }

  const now = new Date();
  const nextLevelText = row.nextLevel
    ? `Program ${row.program} level ${row.nextLevel}`
    : `tahap akhir Program ${row.program} (sertifikat kelulusan)`;
  const subject = `Kabar baik: ${row.name} siap melangkah ke level berikutnya`;
  const body = [
    "Assalamu'alaikum,",
    "",
    `Alhamdulillah, dari pemantauan LIMO, ${row.name} (${row.nomorInduk}) di ${row.kelasName} menunjukkan kesiapan luar biasa:`,
    `- Progres modul: ${row.readiness.moduleProgress === null ? "-" : `${round1(row.readiness.moduleProgress)}%`}`,
    `- Rata-rata nilai: ${row.readiness.averageScore === null ? "-" : round1(row.readiness.averageScore)}`,
    `- Kehadiran: ${row.readiness.attendanceRate === null ? "-" : `${row.readiness.attendanceRate}%`}`,
    "",
    `${row.name} siap untuk ${nextLevelText}. Apabila berminat, tim LIMO siap membantu proses pendaftaran lanjutan dan penjadwalan kelas berikutnya.`,
    "",
    "Salam,",
    "Tim LIMO",
  ].join("\n");

  const notification = await notifyWaliForStudents({
    siswaIds: [siswaId],
    template: "upsell-level",
    subject,
    body,
    metadata: {
      kelasId,
      currentLevel: row.currentLevel,
      nextLevel: row.nextLevel,
      readinessScore: row.readiness.score,
    },
    dedupeKey: `upsell:${siswaId}:${kelasId}:${now.toISOString().slice(0, 7)}`,
    channels: ["email", "whatsapp"],
  });

  return {
    siswaId,
    kelasId,
    nextLevel: row.nextLevel,
    readinessScore: row.readiness.score,
    notificationsCreated: notification.created,
  };
}


