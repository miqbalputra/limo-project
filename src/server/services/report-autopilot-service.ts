import "server-only";

import type { Actor } from "@/server/auth/session";
import { requirePermission } from "@/server/auth/permissions";
import { prisma } from "@/server/db/prisma";
import { ValidationError } from "@/server/errors/application-error";
import { buildDraftSummary, buildSnapshot } from "./progress-report-service";

export type AutopilotClassStatus = {
  kelasId: string;
  kelasName: string;
  program: string;
  level: string;
  guruName: string | null;
  studentCount: number;
  draftCount: number;
  publishedCount: number;
  missingCount: number;
};

export type AutopilotStatus = {
  period: string;
  periodStart: string;
  periodEnd: string;
  totalStudents: number;
  draftCount: number;
  publishedCount: number;
  missingCount: number;
  classes: AutopilotClassStatus[];
};

export type AutopilotRunResult = {
  period: string;
  dryRun: boolean;
  created: number;
  skipped: number;
  failed: number;
  classes: Array<{ kelasId: string; kelasName: string; created: number; skipped: number }>;
};

const PERIOD_PATTERN = /^\d{4}-\d{2}$/;

export function parseAutopilotPeriod(period: string) {
  if (!PERIOD_PATTERN.test(period)) {
    throw new ValidationError("Periode harus berformat YYYY-MM");
  }
  const from = new Date(`${period}-01T00:00:00.000Z`);
  if (Number.isNaN(from.getTime())) {
    throw new ValidationError("Periode belum valid");
  }
  const to = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1));
  return { from, to };
}

export function currentAutopilotPeriod(now = new Date()) {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function loadActiveClassesWithStudents() {
  return prisma.kelas.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      name: true,
      program: { select: { name: true } },
      level: { select: { name: true } },
      guruProfile: { select: { user: { select: { name: true } } } },
      enrollments: {
        where: { status: "ACTIVE", siswa: { status: "ACTIVE", deletedAt: null } },
        select: { siswaId: true, siswa: { select: { id: true, nomorInduk: true, name: true } } },
      },
    },
    orderBy: { name: "asc" },
  });
}

export async function getReportAutopilotStatus(actor: Actor, period: string): Promise<AutopilotStatus> {
  await requirePermission(actor, "admin.reports.view");

  const { from, to } = parseAutopilotPeriod(period);
  const classes = await loadActiveClassesWithStudents();
  const reports = await prisma.progressReport.findMany({
    where: {
      reportType: "MONTHLY",
      kelasId: { in: classes.map((kelas) => kelas.id) },
      periodStart: { gte: from, lt: to },
    },
    select: { kelasId: true, studentId: true, status: true },
  });

  const statusByKelas = new Map<string, { draft: number; published: number; students: Set<string> }>();
  for (const report of reports) {
    const agg = statusByKelas.get(report.kelasId) ?? { draft: 0, published: 0, students: new Set<string>() };
    if (report.status === "DRAFT") agg.draft += 1;
    if (report.status === "PUBLISHED" || report.status === "REVISED") agg.published += 1;
    agg.students.add(report.studentId);
    statusByKelas.set(report.kelasId, agg);
  }

  const classStatuses: AutopilotClassStatus[] = classes.map((kelas) => {
    const agg = statusByKelas.get(kelas.id) ?? { draft: 0, published: 0, students: new Set<string>() };
    const studentCount = kelas.enrollments.length;
    return {
      kelasId: kelas.id,
      kelasName: kelas.name,
      program: kelas.program.name,
      level: kelas.level.name,
      guruName: kelas.guruProfile?.user.name ?? null,
      studentCount,
      draftCount: agg.draft,
      publishedCount: agg.published,
      missingCount: studentCount - agg.students.size,
    };
  });

  return {
    period,
    periodStart: from.toISOString().slice(0, 10),
    periodEnd: new Date(to.getTime() - 86_400_000).toISOString().slice(0, 10),
    totalStudents: classStatuses.reduce((total, item) => total + item.studentCount, 0),
    draftCount: classStatuses.reduce((total, item) => total + item.draftCount, 0),
    publishedCount: classStatuses.reduce((total, item) => total + item.publishedCount, 0),
    missingCount: classStatuses.reduce((total, item) => total + item.missingCount, 0),
    classes: classStatuses,
  };
}

export async function generateMonthlyReportDrafts(actor: Actor | null, input: { period: string; dryRun?: boolean }): Promise<AutopilotRunResult> {
  if (actor) {
    await requirePermission(actor, "admin.reports.view");
  }

  const { period, dryRun = false } = input;
  const { from, to } = parseAutopilotPeriod(period);

  const classes = await loadActiveClassesWithStudents();
  const existing = await prisma.progressReport.findMany({
    where: {
      reportType: "MONTHLY",
      kelasId: { in: classes.map((kelas) => kelas.id) },
      periodStart: { gte: from, lt: to },
    },
    select: { kelasId: true, studentId: true },
  });
  const existingKeys = new Set(existing.map((report) => `${report.kelasId}:${report.studentId}`));

  const result: AutopilotRunResult = {
    period,
    dryRun,
    created: 0,
    skipped: 0,
    failed: 0,
    classes: [],
  };

  for (const kelas of classes) {
    const kelasResult = { kelasId: kelas.id, kelasName: kelas.name, created: 0, skipped: 0 };

    for (const enrollment of kelas.enrollments) {
      const key = `${kelas.id}:${enrollment.siswaId}`;
      if (existingKeys.has(key)) {
        kelasResult.skipped += 1;
        continue;
      }
      existingKeys.add(key);

      try {
        if (dryRun) {
          kelasResult.created += 1;
          continue;
        }

        const snapshot = await buildSnapshot(enrollment.siswaId, kelas.id, from, to);
        await prisma.progressReport.create({
          data: {
            studentId: enrollment.siswaId,
            kelasId: kelas.id,
            reportType: "MONTHLY",
            status: "DRAFT",
            periodStart: from,
            periodEnd: to,
            summary: buildDraftSummary(snapshot, "MONTHLY"),
            strengths: "",
            improvementAreas: "",
            teacherRecommendation: "",
            snapshotData: snapshot,
            createdById: actor?.id ?? null,
          },
        });
        kelasResult.created += 1;
      } catch {
        result.failed += 1;
      }
    }

    result.created += kelasResult.created;
    result.skipped += kelasResult.skipped;
    result.classes.push(kelasResult);
  }

  if (!dryRun && result.created > 0) {
    await prisma.auditLog.create({
      data: {
        actorId: actor?.id ?? null,
        action: "REPORT_AUTOPILOT_GENERATED",
        entityType: "ProgressReport",
        entityId: null,
        metadata: { period, created: result.created, skipped: result.skipped, failed: result.failed },
      },
    });
  }

  return result;
}


