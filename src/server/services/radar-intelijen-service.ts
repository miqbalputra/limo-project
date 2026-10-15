import "server-only";

import { requirePermission } from "@/server/auth/permissions";
import type { Actor } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { NotFoundError, ValidationError } from "@/server/errors/application-error";
import { notifyWaliForStudents } from "./notification-service";

export type RadarRiskLevel = "AMAN" | "WASPADA" | "RISIKO" | "KRITIS";

export type RadarRiskFactorKey = "PRESENSI" | "TREN_PRESENSI" | "NILAI" | "TREN_NILAI" | "PROGRES" | "TAGIHAN";

export type RadarStudentRow = {
  siswaId: string;
  nomorInduk: string;
  name: string;
  program: string;
  kelasNames: string[];
  guruNames: string[];
  score: number;
  level: RadarRiskLevel;
  attendanceRate: number | null;
  attendanceRecent: number | null;
  attendancePrevious: number | null;
  averageScore: number | null;
  latestScore: number | null;
  daysSinceProgress: number | null;
  overdueCount: number;
  overdueAmount: number;
  factors: RadarRiskFactorKey[];
  factorLabels: string[];
};

export type RadarClassHotspot = {
  kelasId: string;
  kelasName: string;
  program: string;
  atRiskCount: number;
  studentCount: number;
};

export type RadarIntel = {
  generatedAt: string;
  windowDays: number;
  totalStudents: number;
  counts: Record<RadarRiskLevel, number>;
  retentionHealth: number | null;
  overdueTotalAmount: number;
  revenueAtRiskAmount: number;
  factorCounts: Record<RadarRiskFactorKey, number>;
  hotspots: RadarClassHotspot[];
  students: RadarStudentRow[];
};

const DAY_MS = 24 * 60 * 60 * 1000;
const RECENT_WINDOW_DAYS = 30;
const TREND_WINDOW_DAYS = 60;
const PROGRESS_STALE_DAYS = 90;

const FACTOR_LABELS: Record<RadarRiskFactorKey, string> = {
  PRESENSI: "Kehadiran rendah",
  TREN_PRESENSI: "Kehadiran menurun",
  NILAI: "Nilai di bawah standar",
  TREN_NILAI: "Nilai menurun",
  PROGRES: "Progres belajar stagnan",
  TAGIHAN: "Tunggakan tagihan",
};

function daysBetween(from: Date, to: Date) {
  return Math.floor((to.getTime() - from.getTime()) / DAY_MS);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function toLevel(score: number): RadarRiskLevel {
  if (score >= 70) return "KRITIS";
  if (score >= 45) return "RISIKO";
  if (score >= 20) return "WASPADA";
  return "AMAN";
}

type StudentRadarRaw = {
  siswaId: string;
  nomorInduk: string;
  name: string;
  program: string;
  kelasNames: string[];
  guruNames: string[];
  attendanceRecent: number | null;
  attendancePrevious: number | null;
  averageScore: number | null;
  latestScore: number | null;
  lastProgressAt: Date | null;
  overdueCount: number;
  overdueAmount: number;
};

function computeRadarRow(raw: StudentRadarRaw, now: Date): RadarStudentRow {
  const factors: RadarRiskFactorKey[] = [];
  const factorLabels: string[] = [];
  let score = 0;

  const attendanceRate = raw.attendanceRecent;
  if (attendanceRate !== null && attendanceRate < 75) {
    factors.push("PRESENSI");
    factorLabels.push(`${FACTOR_LABELS.PRESENSI} (${attendanceRate}% dalam 30 hari)`);
    score += clamp((75 - attendanceRate) * 1.2, 0, 35);
  }

  if (raw.attendanceRecent !== null && raw.attendancePrevious !== null) {
    const decline = raw.attendancePrevious - raw.attendanceRecent;
    if (decline > 15) {
      factors.push("TREN_PRESENSI");
      factorLabels.push(`${FACTOR_LABELS.TREN_PRESENSI} (${round1(decline)} poin)`);
      score += clamp((decline - 15) * 0.5, 0, 10);
    }
  }

  if (raw.averageScore !== null) {
    if (raw.averageScore < 70) {
      factors.push("NILAI");
      factorLabels.push(`${FACTOR_LABELS.NILAI} (rata-rata ${round1(raw.averageScore)})`);
      score += clamp((70 - raw.averageScore) * 0.35, 0, 15);
    }
    if (raw.latestScore !== null && raw.averageScore - raw.latestScore > 10) {
      factors.push("TREN_NILAI");
      factorLabels.push(`${FACTOR_LABELS.TREN_NILAI} (terakhir ${round1(raw.latestScore)} vs rata-rata ${round1(raw.averageScore)})`);
      score += 5;
    }
  }

  let daysSinceProgress: number | null = null;
  if (raw.lastProgressAt) {
    daysSinceProgress = Math.max(0, daysBetween(raw.lastProgressAt, now));
  }

  if (daysSinceProgress === null || daysSinceProgress > PROGRESS_STALE_DAYS) {
    factors.push("PROGRES");
    factorLabels.push(daysSinceProgress === null ? `${FACTOR_LABELS.PROGRES} (belum ada catatan)` : `${FACTOR_LABELS.PROGRES} (${daysSinceProgress} hari tanpa catatan)`);
    score += daysSinceProgress === null ? 8 : 12;
  } else if (daysSinceProgress > 30) {
    factors.push("PROGRES");
    factorLabels.push(`${FACTOR_LABELS.PROGRES} (${daysSinceProgress} hari tanpa catatan)`);
    score += clamp((daysSinceProgress - 30) * 0.25, 0, 8);
  }

  if (raw.overdueCount > 0) {
    factors.push("TAGIHAN");
    factorLabels.push(`${FACTOR_LABELS.TAGIHAN} (${raw.overdueCount} tagihan jatuh tempo)`);
    score += clamp(raw.overdueCount * 8, 0, 20);
  }

  const finalScore = Math.round(clamp(score, 0, 100));

  return {
    siswaId: raw.siswaId,
    nomorInduk: raw.nomorInduk,
    name: raw.name,
    program: raw.program,
    kelasNames: raw.kelasNames,
    guruNames: raw.guruNames,
    score: finalScore,
    level: toLevel(finalScore),
    attendanceRate,
    attendanceRecent: raw.attendanceRecent,
    attendancePrevious: raw.attendancePrevious,
    averageScore: raw.averageScore === null ? null : round1(raw.averageScore),
    latestScore: raw.latestScore === null ? null : round1(raw.latestScore),
    daysSinceProgress,
    overdueCount: raw.overdueCount,
    overdueAmount: raw.overdueAmount,
    factors,
    factorLabels,
  };
}

async function collectRawRadarData(siswaIds: string[], now: Date): Promise<Map<string, StudentRadarRaw>> {
  const result = new Map<string, StudentRadarRaw>();
  if (siswaIds.length === 0) {
    return result;
  }

  const recentCutoff = new Date(now.getTime() - RECENT_WINDOW_DAYS * DAY_MS);
  const trendCutoff = new Date(now.getTime() - TREND_WINDOW_DAYS * DAY_MS);
  const progressCutoff = new Date(now.getTime() - PROGRESS_STALE_DAYS * DAY_MS);

  const [students, presensiRows, hasilRows, progresGroups, tagihanGroups] = await Promise.all([
    prisma.siswa.findMany({
      where: { id: { in: siswaIds } },
      select: {
        id: true,
        nomorInduk: true,
        name: true,
        program: { select: { name: true } },
        enrollments: {
          where: { status: "ACTIVE", kelas: { status: "ACTIVE" } },
          select: {
            kelas: {
              select: {
                id: true,
                name: true,
                program: { select: { name: true } },
                guruProfile: { select: { user: { select: { name: true } } } },
              },
            },
          },
        },
      },
    }),
    prisma.presensi.findMany({
      where: { siswaId: { in: siswaIds }, sesiKelas: { sessionDate: { gte: trendCutoff, lte: now } } },
      select: { siswaId: true, status: true, sesiKelas: { select: { sessionDate: true } } },
    }),
    prisma.hasilUjian.findMany({
      where: { siswaId: { in: siswaIds }, status: { in: ["FINAL", "CORRECTED"] }, releasedAt: { not: null } },
      select: { siswaId: true, totalScore: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.progresBelajar.groupBy({
      by: ["siswaId"],
      where: { siswaId: { in: siswaIds }, createdAt: { gte: progressCutoff } },
      _max: { createdAt: true },
    }),
    prisma.tagihan.groupBy({
      by: ["siswaId"],
      where: { siswaId: { in: siswaIds }, status: { in: ["UNPAID", "PENDING", "OVERDUE"] }, dueDate: { lt: now } },
      _count: { _all: true },
      _sum: { amount: true, discountAmount: true },
    }),
  ]);

  for (const student of students) {
    result.set(student.id, {
      siswaId: student.id,
      nomorInduk: student.nomorInduk,
      name: student.name,
      program: student.program.name,
      kelasNames: student.enrollments.map((enrollment) => enrollment.kelas.name),
      guruNames: [...new Set(student.enrollments.map((enrollment) => enrollment.kelas.guruProfile?.user?.name).filter((name): name is string => Boolean(name)))],
      attendanceRecent: null,
      attendancePrevious: null,
      averageScore: null,
      latestScore: null,
      lastProgressAt: null,
      overdueCount: 0,
      overdueAmount: 0,
    });
  }

  const attendanceAgg = new Map<string, { recentTotal: number; recentPresent: number; previousTotal: number; previousPresent: number }>();
  for (const row of presensiRows) {
    const sessionDate = row.sesiKelas.sessionDate;
    const isPresent = row.status === "HADIR" || row.status === "TERLAMBAT";
    const agg = attendanceAgg.get(row.siswaId) ?? { recentTotal: 0, recentPresent: 0, previousTotal: 0, previousPresent: 0 };
    if (sessionDate >= recentCutoff) {
      agg.recentTotal += 1;
      if (isPresent) agg.recentPresent += 1;
    } else {
      agg.previousTotal += 1;
      if (isPresent) agg.previousPresent += 1;
    }
    attendanceAgg.set(row.siswaId, agg);
  }
  for (const [siswaId, agg] of attendanceAgg) {
    const raw = result.get(siswaId);
    if (!raw) continue;
    raw.attendanceRecent = agg.recentTotal > 0 ? Math.round((agg.recentPresent / agg.recentTotal) * 100) : null;
    raw.attendancePrevious = agg.previousTotal > 0 ? Math.round((agg.previousPresent / agg.previousTotal) * 100) : null;
  }

  const scoreAgg = new Map<string, { total: number; count: number; latest: number | null }>();
  for (const row of hasilRows) {
    if (row.totalScore === null) continue;
    const value = Number(row.totalScore);
    if (!Number.isFinite(value)) continue;
    const agg = scoreAgg.get(row.siswaId) ?? { total: 0, count: 0, latest: null };
    agg.total += value;
    agg.count += 1;
    if (agg.latest === null) agg.latest = value;
    scoreAgg.set(row.siswaId, agg);
  }
  for (const [siswaId, agg] of scoreAgg) {
    const raw = result.get(siswaId);
    if (!raw) continue;
    raw.averageScore = agg.count > 0 ? agg.total / agg.count : null;
    raw.latestScore = agg.latest;
  }

  for (const group of progresGroups) {
    const raw = result.get(group.siswaId);
    if (!raw || !group._max.createdAt) continue;
    raw.lastProgressAt = group._max.createdAt;
  }

  for (const group of tagihanGroups) {
    const raw = result.get(group.siswaId);
    if (!raw) continue;
    raw.overdueCount = group._count._all;
    raw.overdueAmount = Number(group._sum.amount ?? 0) - Number(group._sum.discountAmount ?? 0);
  }

  return result;
}

function buildRadarIntel(rows: RadarStudentRow[], now: Date): RadarIntel {
  const counts: Record<RadarRiskLevel, number> = { AMAN: 0, WASPADA: 0, RISIKO: 0, KRITIS: 0 };
  const factorCounts: Record<RadarRiskFactorKey, number> = {
    PRESENSI: 0,
    TREN_PRESENSI: 0,
    NILAI: 0,
    TREN_NILAI: 0,
    PROGRES: 0,
    TAGIHAN: 0,
  };
  let overdueTotalAmount = 0;
  let revenueAtRiskAmount = 0;

  for (const row of rows) {
    counts[row.level] += 1;
    overdueTotalAmount += row.overdueAmount;
    if (row.level === "RISIKO" || row.level === "KRITIS") {
      revenueAtRiskAmount += row.overdueAmount;
    }
    for (const factor of row.factors) {
      factorCounts[factor] += 1;
    }
  }

  const totalStudents = rows.length;
  const retentionHealth = totalStudents === 0 ? null : Math.round(((counts.AMAN + counts.WASPADA * 0.6) / totalStudents) * 100);

  const sorted = [...rows].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  return {
    generatedAt: now.toISOString(),
    windowDays: TREND_WINDOW_DAYS,
    totalStudents,
    counts,
    retentionHealth,
    overdueTotalAmount,
    revenueAtRiskAmount,
    factorCounts,
    hotspots: buildHotspots(rows),
    students: sorted,
  };
}

function buildHotspots(rows: RadarStudentRow[]): RadarClassHotspot[] {
  const hotspotAgg = new Map<string, RadarClassHotspot>();
  for (const row of rows) {
    if (row.level !== "RISIKO" && row.level !== "KRITIS") continue;
    for (const kelasName of row.kelasNames) {
      const existing = hotspotAgg.get(kelasName) ?? { kelasId: kelasName, kelasName, program: row.program, atRiskCount: 0, studentCount: 0 };
      existing.atRiskCount += 1;
      hotspotAgg.set(kelasName, existing);
    }
  }
  return [...hotspotAgg.values()].sort((a, b) => b.atRiskCount - a.atRiskCount).slice(0, 5);
}

export async function getRadarIntel(actor: Actor): Promise<RadarIntel> {
  await requirePermission(actor, "admin.radar.view");

  const now = new Date();
  const students = await prisma.siswa.findMany({
    where: { status: "ACTIVE", deletedAt: null },
    select: { id: true },
  });

  const raw = await collectRawRadarData(students.map((student) => student.id), now);
  const rows = [...raw.values()].map((item) => computeRadarRow(item, now));
  return buildRadarIntel(rows, now);
}

export async function sendRadarIntervensi(actor: Actor, siswaId: string) {
  await requirePermission(actor, "admin.radar.view");

  const now = new Date();
  const raw = await collectRawRadarData([siswaId], now);
  const item = raw.get(siswaId);
  if (!item) {
    throw new NotFoundError("Siswa tidak ditemukan atau tidak aktif");
  }

  const row = computeRadarRow(item, now);
  if (row.level === "AMAN") {
    throw new ValidationError("Siswa masih dalam kondisi aman; intervensi hanya untuk siswa berisiko.");
  }

  const detailLines = row.factorLabels.length > 0 ? row.factorLabels.map((label) => `- ${label}`).join("\n") : "- Indikator risiko terdeteksi pada data terbaru";
  const subject = `LIMO Radar: perhatian untuk perkembangan ${row.name}`;
  const body = [
    "Assalamu'alaikum,",
    "",
    `Melalui pemantauan LIMO Radar, kami mendeteksi bahwa ${row.name} (${row.nomorInduk}) berada pada level ${row.level} dengan skor risiko ${row.score}/100.`,
    "",
    "Indikator yang terdeteksi:",
    detailLines,
    "",
    "Yuk, mari kita dampingi proses belajarnya bersama. Tim LIMO siap membantu mengatur ulang jadwal, bimbingan tambahan, atau penjadwalan ulang pembayaran bila diperlukan.",
    "",
    "Salam,",
    "Tim LIMO",
  ].join("\n");

  const notification = await notifyWaliForStudents({
    siswaIds: [siswaId],
    template: "radar-intervensi",
    subject,
    body,
    metadata: {
      radarLevel: row.level,
      radarScore: row.score,
      overdueCount: row.overdueCount,
    },
    dedupeKey: `radar-intervensi:${siswaId}:${now.toISOString().slice(0, 10)}`,
    channels: ["email", "whatsapp"],
  });

  return {
    siswaId,
    level: row.level,
    score: row.score,
    notificationsCreated: notification.created,
  };
}



