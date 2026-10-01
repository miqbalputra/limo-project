import "server-only";

import type { Prisma } from "@prisma/client";
import type { Actor } from "@/server/auth/session";
import { requirePermission } from "@/server/auth/permissions";
import { prisma } from "@/server/db/prisma";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/errors/application-error";
import { canAccessStudent, canManageClass } from "@/server/policies/access-policy";
import { createPaginationMeta, resolvePagination, type PaginationInput } from "@/server/pagination";
import { notifySiswaForStudents, notifyWaliForStudents } from "@/server/services/notification-service";
import { generateProgressReportSchema, reviseProgressReportSchema, updateProgressReportSchema } from "@/server/validation/progress-report";

const itemSelect = {
  id: true,
  reportType: true,
  status: true,
  periodStart: true,
  periodEnd: true,
  summary: true,
  strengths: true,
  improvementAreas: true,
  teacherRecommendation: true,
  snapshotData: true,
  publishedAt: true,
  revisedAt: true,
  revisionReason: true,
  createdAt: true,
  updatedAt: true,
  student: { select: { id: true, name: true, nomorInduk: true } },
  kelas: { select: { id: true, name: true, program: { select: { name: true } }, level: { select: { name: true } } } },
  createdBy: { select: { id: true, name: true } },
  _count: { select: { reads: true } },
} as const;

const REPORT_TYPE_LABEL: Record<string, string> = {
  WEEKLY: "Mingguan",
  MONTHLY: "Bulanan",
  LEVEL_COMPLETION: "Penyelesaian level",
};

function toIso(value: Date | null) {
  return value ? value.toISOString() : null;
}

function resolveReportPeriod(startValue: string, endValue: string) {
  const from = new Date(`${startValue}T00:00:00.000Z`);
  const endInclusive = new Date(`${endValue}T00:00:00.000Z`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(endInclusive.getTime())) {
    throw new ValidationError("Periode laporan belum valid");
  }
  const to = new Date(endInclusive.getTime() + 86_400_000);
  if (to <= from) {
    throw new ValidationError("Tanggal akhir harus setelah tanggal mulai");
  }
  if (to.getTime() - from.getTime() > 400 * 86_400_000) {
    throw new ValidationError("Rentang periode maksimal 400 hari");
  }
  return { from, to };
}

async function buildSnapshot(studentId: string, kelasId: string, from: Date, to: Date) {
  const [presensi, progres, exams, submissions, requiredItems, completedItems, finalGrade] = await Promise.all([
    prisma.presensi.findMany({
      where: { siswaId: studentId, sesiKelas: { kelasId, sessionDate: { gte: from, lt: to } } },
      select: { status: true },
    }),
    prisma.progresBelajar.findMany({
      where: { siswaId: studentId, sesiKelas: { kelasId, sessionDate: { gte: from, lt: to } } },
      select: { understandingScore: true, category: true },
    }),
    prisma.hasilUjian.findMany({
      where: { siswaId: studentId, ujian: { kelasId }, status: { in: ["FINAL", "CORRECTED"] }, updatedAt: { gte: from, lt: to } },
      orderBy: { updatedAt: "desc" },
      select: { totalScore: true, ujian: { select: { title: true } } },
    }),
    prisma.assignmentSubmission.findMany({
      where: { studentId, assignment: { kelasId }, createdAt: { gte: from, lt: to } },
      select: { status: true, isLate: true },
    }),
    prisma.moduleItem.count({ where: { isRequired: true, module: { kelasId, status: "PUBLISHED" } } }),
    prisma.studentActivityCompletion.count({
      where: { studentId, status: "COMPLETED", moduleItem: { module: { kelasId, status: "PUBLISHED" } } },
    }),
    prisma.finalGrade.findFirst({
      where: { studentId, classId: kelasId, status: { in: ["PUBLISHED", "CORRECTED"] } },
      select: { publishedScore: true, calculatedScore: true, letterGrade: true },
    }),
  ]);

  const attendanceTotal = presensi.length;
  const attendancePresent = presensi.filter((item) => item.status === "HADIR" || item.status === "TERLAMBAT").length;
  const progressScores = progres.map((item) => item.understandingScore);
  const examScores = exams.map((item) => Number(item.totalScore || 0));
  const gradedSubmissions = submissions.filter((item) => item.status === "GRADED").length;
  const lateSubmissions = submissions.filter((item) => item.isLate).length;

  return {
    generatedAt: new Date().toISOString(),
    attendance: {
      total: attendanceTotal,
      present: attendancePresent,
      rate: attendanceTotal ? Math.round((attendancePresent / attendanceTotal) * 100) : null,
    },
    progress: {
      count: progressScores.length,
      average: progressScores.length ? Number((progressScores.reduce((sum, value) => sum + value, 0) / progressScores.length).toFixed(1)) : null,
    },
    exams: {
      count: examScores.length,
      average: examScores.length ? Number((examScores.reduce((sum, value) => sum + value, 0) / examScores.length).toFixed(1)) : null,
      items: exams.slice(0, 20).map((item) => ({ title: item.ujian.title, score: Number(item.totalScore || 0) })),
    },
    assignments: {
      total: submissions.length,
      graded: gradedSubmissions,
      late: lateSubmissions,
    },
    completion: {
      required: requiredItems,
      completed: completedItems,
      percentage: requiredItems ? Math.round((completedItems / requiredItems) * 100) : null,
    },
    finalGrade: finalGrade
      ? { score: Number(finalGrade.publishedScore ?? finalGrade.calculatedScore ?? 0), letter: finalGrade.letterGrade ?? null }
      : null,
  };
}

type Snapshot = Awaited<ReturnType<typeof buildSnapshot>>;

function buildDraftSummary(snapshot: Snapshot, reportType: string) {
  const parts: string[] = [];
  parts.push(`Ringkasan otomatis laporan ${REPORT_TYPE_LABEL[reportType] ?? reportType}.`);
  if (snapshot.attendance.rate !== null) {
    parts.push(`Kehadiran ${snapshot.attendance.present}/${snapshot.attendance.total} pertemuan (${snapshot.attendance.rate}%).`);
  } else {
    parts.push("Belum ada data kehadiran pada periode ini.");
  }
  if (snapshot.completion.percentage !== null) {
    parts.push(`Penyelesaian aktivitas wajib ${snapshot.completion.completed}/${snapshot.completion.required} (${snapshot.completion.percentage}%).`);
  }
  if (snapshot.progress.average !== null) {
    parts.push(`Rata-rata pemahaman ${snapshot.progress.average}/5.`);
  }
  if (snapshot.exams.average !== null) {
    parts.push(`Rata-rata nilai ujian ${snapshot.exams.average}.`);
  }
  if (snapshot.finalGrade) {
    parts.push(`Nilai akhir terbit ${snapshot.finalGrade.score}${snapshot.finalGrade.letter ? ` (${snapshot.finalGrade.letter})` : ""}.`);
  }
  return parts.join(" ");
}

async function assertCanManageReport(actor: Actor, kelasId: string) {
  if (actor.role === "ADMIN") {
    await requirePermission(actor, "admin.reports.view");
    return;
  }
  await requirePermission(actor, "guru.report.manage");
  if (!(await canManageClass(actor, kelasId))) {
    throw new ForbiddenError("Anda tidak mengelola kelas ini");
  }
}

async function findVisibleReportForStudentViewer(actor: Actor, reportId: string) {
  const report = await prisma.progressReport.findUnique({
    where: { id: reportId },
    select: { id: true, kelasId: true, studentId: true, status: true },
  });
  if (!report) throw new NotFoundError("Laporan tidak ditemukan");

  if (actor.role === "ADMIN") {
    await requirePermission(actor, "admin.reports.view");
    return report;
  }
  if (actor.role === "GURU") {
    await requirePermission(actor, "guru.report.manage");
    if (!(await canManageClass(actor, report.kelasId))) throw new NotFoundError("Laporan tidak ditemukan");
    return report;
  }

  const published = report.status === "PUBLISHED" || report.status === "REVISED";
  if (!published || !(await canAccessStudent(actor, report.studentId))) {
    throw new NotFoundError("Laporan tidak ditemukan");
  }
  return report;
}

export async function generateProgressReportDraft(actor: Actor, input: unknown) {
  const parsed = generateProgressReportSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError("Permintaan belum valid", parsed.error.flatten().fieldErrors);
  }

  await assertCanManageReport(actor, parsed.data.kelasId);

  const enrollment = await prisma.kelasSiswa.findFirst({
    where: { kelasId: parsed.data.kelasId, siswaId: parsed.data.studentId, status: "ACTIVE" },
    select: { id: true },
  });
  if (!enrollment) {
    throw new ValidationError("Siswa tidak terdaftar aktif pada kelas ini");
  }

  const { from, to } = resolveReportPeriod(parsed.data.periodStart, parsed.data.periodEnd);
  const snapshot = await buildSnapshot(parsed.data.studentId, parsed.data.kelasId, from, to);

  const item = await prisma.progressReport.create({
    data: {
      studentId: parsed.data.studentId,
      kelasId: parsed.data.kelasId,
      reportType: parsed.data.reportType,
      status: "DRAFT",
      periodStart: from,
      periodEnd: to,
      summary: buildDraftSummary(snapshot, parsed.data.reportType),
      strengths: "",
      improvementAreas: "",
      teacherRecommendation: "",
      snapshotData: snapshot,
      createdById: actor.id,
    },
    select: itemSelect,
  });

  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: "PROGRESS_REPORT_CREATED",
      entityType: "ProgressReport",
      entityId: item.id,
      metadata: { kelasId: item.kelas.id, studentId: item.student.id, reportType: item.reportType },
    },
  });

  return { item };
}

export async function listProgressReports(actor: Actor, input: Partial<PaginationInput> & { kelasId?: string; studentId?: string; status?: string } = {}) {
  const pagination = resolvePagination(input, 20);
  const filters: Prisma.ProgressReportWhereInput = {
    ...(input.kelasId ? { kelasId: input.kelasId } : {}),
    ...(input.studentId ? { studentId: input.studentId } : {}),
  };

  let where: Prisma.ProgressReportWhereInput;
  let includeRead = false;

  if (actor.role === "ADMIN") {
    await requirePermission(actor, "admin.reports.view");
    where = { ...filters, ...(input.status ? { status: input.status as never } : {}) };
  } else if (actor.role === "GURU") {
    await requirePermission(actor, "guru.report.manage");
    where = { ...filters, kelas: { guruProfile: { userId: actor.id } }, ...(input.status ? { status: input.status as never } : {}) };
  } else if (actor.role === "WALI") {
    const relations = await prisma.waliSiswa.findMany({
      where: { endedAt: null, waliProfile: { userId: actor.id }, siswa: { status: "ACTIVE", deletedAt: null }, ...(input.studentId ? { siswaId: input.studentId } : {}) },
      select: { siswaId: true },
    });
    where = { studentId: { in: relations.map((relation) => relation.siswaId) }, status: { in: ["PUBLISHED", "REVISED"] } };
    includeRead = true;
  } else if (actor.role === "SISWA") {
    const account = await prisma.siswaAccount.findUnique({ where: { userId: actor.id }, select: { siswaId: true, status: true } });
    where = { studentId: account?.status === "ACTIVE" ? account.siswaId : "__none__", status: { in: ["PUBLISHED", "REVISED"] } };
    includeRead = true;
  } else {
    throw new ForbiddenError();
  }

  const [totalItems, entries] = await Promise.all([
    prisma.progressReport.count({ where }),
    prisma.progressReport.findMany({
      where,
      orderBy: [{ periodStart: "desc" }, { createdAt: "desc" }],
      skip: pagination.skip,
      take: pagination.take,
      select: includeRead ? { ...itemSelect, reads: { where: { userId: actor.id }, take: 1, select: { readAt: true } } } : itemSelect,
    }),
  ]);

  return {
    items: entries.map((entry) => ({
      ...entry,
      periodStart: entry.periodStart.toISOString(),
      periodEnd: entry.periodEnd.toISOString(),
      publishedAt: toIso(entry.publishedAt),
      revisedAt: toIso(entry.revisedAt),
      createdAt: entry.createdAt.toISOString(),
      updatedAt: entry.updatedAt.toISOString(),
      readCount: entry._count.reads,
      isRead: includeRead && "reads" in entry ? (entry.reads as { readAt: Date }[]).length > 0 : null,
      reads: undefined,
    })),
    pagination: createPaginationMeta(pagination.page, pagination.pageSize, totalItems),
  };
}

export async function getProgressReport(actor: Actor, reportId: string) {
  const scoped = await findVisibleReportForStudentViewer(actor, reportId);
  const item = await prisma.progressReport.findUnique({
    where: { id: scoped.id },
    select: { ...itemSelect, reads: { where: { userId: actor.id }, take: 1, select: { readAt: true } } },
  });
  if (!item) throw new NotFoundError("Laporan tidak ditemukan");

  return {
    item: {
      ...item,
      periodStart: item.periodStart.toISOString(),
      periodEnd: item.periodEnd.toISOString(),
      publishedAt: toIso(item.publishedAt),
      revisedAt: toIso(item.revisedAt),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      readCount: item._count.reads,
      isRead: item.reads.length > 0,
      reads: undefined,
    },
  };
}

export async function updateProgressReportDraft(actor: Actor, reportId: string, input: unknown) {
  const parsed = updateProgressReportSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError("Perubahan belum valid", parsed.error.flatten().fieldErrors);
  }

  const report = await prisma.progressReport.findUnique({ where: { id: reportId }, select: { id: true, kelasId: true, status: true } });
  if (!report) throw new NotFoundError("Laporan tidak ditemukan");
  await assertCanManageReport(actor, report.kelasId);
  if (report.status !== "DRAFT") {
    throw new ValidationError("Hanya draf yang dapat diubah. Gunakan revisi untuk laporan yang sudah terbit.");
  }

  const item = await prisma.progressReport.update({
    where: { id: report.id },
    data: {
      ...(parsed.data.summary !== undefined ? { summary: parsed.data.summary } : {}),
      ...(parsed.data.strengths !== undefined ? { strengths: parsed.data.strengths } : {}),
      ...(parsed.data.improvementAreas !== undefined ? { improvementAreas: parsed.data.improvementAreas } : {}),
      ...(parsed.data.teacherRecommendation !== undefined ? { teacherRecommendation: parsed.data.teacherRecommendation } : {}),
    },
    select: itemSelect,
  });

  await prisma.auditLog.create({
    data: { actorId: actor.id, action: "PROGRESS_REPORT_UPDATED", entityType: "ProgressReport", entityId: item.id, metadata: { kelasId: item.kelas.id, studentId: item.student.id } },
  });

  return { item };
}

async function notifyProgressReport(reportId: string) {
  const report = await prisma.progressReport.findUnique({
    where: { id: reportId },
    select: { id: true, studentId: true, kelasId: true, status: true, periodStart: true, periodEnd: true, revisedAt: true },
  });
  if (!report || (report.status !== "PUBLISHED" && report.status !== "REVISED")) {
    return { notified: false };
  }

  const claimed = await prisma.progressReport.updateMany({ where: { id: report.id, notifiedAt: null }, data: { notifiedAt: new Date() } });
  if (claimed.count !== 1) return { notified: false };

  const periodLabel = `${report.periodStart.toISOString().slice(0, 10)} s/d ${new Date(report.periodEnd.getTime() - 86_400_000).toISOString().slice(0, 10)}`;
  const payload = {
    siswaIds: [report.studentId],
    template: "laporan-perkembangan",
    subject: "Laporan perkembangan terbaru tersedia",
    body: `Laporan perkembangan periode ${periodLabel} telah diterbitkan. Buka menu Laporan untuk membacanya.`,
    metadata: { reportId: report.id, kelasId: report.kelasId, studentId: report.studentId },
    dedupeKey: `progress-report:${report.id}:${report.revisedAt?.toISOString() ?? "initial"}`,
  };

  await notifyWaliForStudents(payload);
  await notifySiswaForStudents({
    siswaIds: payload.siswaIds,
    template: payload.template,
    subject: payload.subject,
    body: payload.body,
    metadata: payload.metadata,
    dedupeKey: payload.dedupeKey,
  });

  return { notified: true };
}

export async function publishProgressReport(actor: Actor, reportId: string) {
  const report = await prisma.progressReport.findUnique({ where: { id: reportId }, select: { id: true, kelasId: true, status: true } });
  if (!report) throw new NotFoundError("Laporan tidak ditemukan");
  await assertCanManageReport(actor, report.kelasId);

  if (report.status === "DRAFT") {
    await prisma.progressReport.update({ where: { id: report.id }, data: { status: "PUBLISHED", publishedAt: new Date() } });
    await prisma.auditLog.create({
      data: { actorId: actor.id, action: "PROGRESS_REPORT_PUBLISHED", entityType: "ProgressReport", entityId: report.id, metadata: { kelasId: report.kelasId } },
    });
  }

  await notifyProgressReport(report.id);
  return getProgressReport(actor, report.id);
}

export async function reviseProgressReport(actor: Actor, reportId: string, input: unknown) {
  const parsed = reviseProgressReportSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError("Revisi belum valid", parsed.error.flatten().fieldErrors);
  }

  const report = await prisma.progressReport.findUnique({
    where: { id: reportId },
    select: { id: true, kelasId: true, status: true, summary: true, strengths: true, improvementAreas: true, teacherRecommendation: true },
  });
  if (!report) throw new NotFoundError("Laporan tidak ditemukan");
  await assertCanManageReport(actor, report.kelasId);
  if (report.status === "DRAFT") {
    throw new ValidationError("Terbitkan laporan sebelum membuat revisi.");
  }

  const item = await prisma.progressReport.update({
    where: { id: report.id },
    data: {
      status: "REVISED",
      revisedAt: new Date(),
      revisionReason: parsed.data.reason,
      notifiedAt: null,
      ...(parsed.data.summary !== undefined ? { summary: parsed.data.summary } : {}),
      ...(parsed.data.strengths !== undefined ? { strengths: parsed.data.strengths } : {}),
      ...(parsed.data.improvementAreas !== undefined ? { improvementAreas: parsed.data.improvementAreas } : {}),
      ...(parsed.data.teacherRecommendation !== undefined ? { teacherRecommendation: parsed.data.teacherRecommendation } : {}),
    },
    select: itemSelect,
  });

  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      action: "PROGRESS_REPORT_REVISED",
      entityType: "ProgressReport",
      entityId: item.id,
      metadata: {
        kelasId: item.kelas.id,
        studentId: item.student.id,
        reason: parsed.data.reason,
        before: {
          summary: report.summary,
          strengths: report.strengths,
          improvementAreas: report.improvementAreas,
          teacherRecommendation: report.teacherRecommendation,
        },
      },
    },
  });

  await notifyProgressReport(report.id);
  return getProgressReport(actor, report.id);
}

export async function markProgressReportRead(actor: Actor, reportId: string) {
  if (actor.role !== "WALI" && actor.role !== "SISWA") {
    throw new ForbiddenError("Hanya wali atau siswa yang menandai laporan dibaca");
  }

  await findVisibleReportForStudentViewer(actor, reportId);

  await prisma.progressReportRead.upsert({
    where: { reportId_userId: { reportId, userId: actor.id } },
    create: { reportId, userId: actor.id },
    update: {},
  });

  return { success: true, unreadCount: await countUnreadProgressReports(actor) };
}

export async function countUnreadProgressReports(actor: Actor) {
  if (actor.role === "WALI") {
    const relations = await prisma.waliSiswa.findMany({ where: { endedAt: null, waliProfile: { userId: actor.id } }, select: { siswaId: true } });
    const studentIds = relations.map((relation) => relation.siswaId);
    if (studentIds.length === 0) return 0;
    return prisma.progressReport.count({
      where: { studentId: { in: studentIds }, status: { in: ["PUBLISHED", "REVISED"] }, reads: { none: { userId: actor.id } } },
    });
  }

  if (actor.role === "SISWA") {
    const account = await prisma.siswaAccount.findUnique({ where: { userId: actor.id }, select: { siswaId: true, status: true } });
    if (!account || account.status !== "ACTIVE") return 0;
    return prisma.progressReport.count({
      where: { studentId: account.siswaId, status: { in: ["PUBLISHED", "REVISED"] }, reads: { none: { userId: actor.id } } },
    });
  }

  return 0;
}
