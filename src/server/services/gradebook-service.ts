import "server-only";

import { createHash } from "node:crypto";
import type { Actor } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/errors/application-error";
import { requireFeature } from "@/server/features/feature-flags";
import { canAccessStudent, canManageClass } from "@/server/policies/access-policy";
import { notifyWaliForStudents } from "@/server/services/notification-service";
import { gradeCategorySchema, gradeEntrySchema, gradeItemSchema, publishFinalGradesSchema, updateGradeCategorySchema, updateGradeCategoryStatusSchema, updateGradeItemStatusSchema } from "@/server/validation/gradebook";

const sourceTypes = ["ASSIGNMENT", "QUIZ", "EXAM", "MANUAL", "ATTENDANCE", "PROGRESS"] as const;
type SourceType = (typeof sourceTypes)[number];

type SourceEntry = {
  studentId: string;
  rawScore: number | null;
  normalizedScore: number | null;
  status: "MISSING" | "SUBMITTED" | "GRADED" | "FINAL";
  isLate: boolean;
  feedbackSummary: string | null;
  sourceVersion: string | null;
};

type GradebookItem = {
  id: string;
  categoryId: string;
  sourceType: SourceType;
  sourceId: string | null;
  title: string;
  order: number;
  maxScore: unknown;
  weightOverride: unknown;
  isExtraCredit: boolean;
  status: string;
  dueAt: Date | null;
  entries: Array<{ studentId: string; rawScore: unknown; normalizedScore: unknown; status: string; isLate: boolean; feedbackSummary: string | null; sourceVersion: string | null }>;
};

function requireGradebookFeature() {
  requireFeature("gradebookEnabled", "Gradebook belum diaktifkan");
}

async function assertGuruClass(actor: Actor, classId: string) {
  requireGradebookFeature();
  if (actor.role !== "GURU" || !(await canManageClass(actor, classId))) throw new ForbiddenError("Anda tidak memiliki akses mengelola gradebook kelas ini");
}

async function assertStudentClass(actor: Actor, classId: string) {
  requireGradebookFeature();
  if (actor.role !== "SISWA") throw new ForbiddenError("Gradebook ini hanya tersedia untuk akun Siswa");
  const account = await prisma.siswaAccount.findUnique({ where: { userId: actor.id }, select: { siswaId: true, status: true, siswa: { select: { status: true, deletedAt: true } } } });
  if (!account || account.status !== "ACTIVE" || account.siswa.status !== "ACTIVE" || account.siswa.deletedAt) throw new ForbiddenError("Akun Siswa belum aktif");
  const enrollment = await prisma.kelasSiswa.findFirst({ where: { kelasId: classId, siswaId: account.siswaId, status: "ACTIVE", kelas: { status: "ACTIVE" } }, select: { siswaId: true } });
  if (!enrollment) throw new NotFoundError("Kelas tidak ditemukan");
  return enrollment.siswaId;
}

async function assertWaliClass(actor: Actor, studentId: string, classId: string) {
  requireGradebookFeature();
  if (actor.role !== "WALI" || !(await canAccessStudent(actor, studentId))) throw new ForbiddenError("Anda tidak memiliki akses ke gradebook siswa ini");
  const enrollment = await prisma.kelasSiswa.findFirst({ where: { kelasId: classId, siswaId: studentId, status: "ACTIVE", kelas: { status: "ACTIVE" } }, select: { id: true } });
  if (!enrollment) throw new NotFoundError("Kelas tidak ditemukan");
}

function toNumber(value: unknown) {
  return value === null || value === undefined ? null : Number(value);
}

function roundScore(value: number | null) {
  return value === null ? null : Math.round((value + Number.EPSILON) * 100) / 100;
}

function parseDateTime(value: string | undefined) {
  if (!value) return undefined;
  const normalized = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? `${value}:00+07:00` : value;
  const result = new Date(normalized);
  if (Number.isNaN(result.getTime())) throw new ValidationError("Tanggal gradebook belum valid");
  return result;
}

async function hasPublishedFinal(classId: string) {
  return (await prisma.finalGrade.count({ where: { classId, status: { in: ["PUBLISHED", "LOCKED", "CORRECTED"] } } })) > 0;
}

async function assertConfigurationChange(classId: string, confirmed: boolean) {
  if (await hasPublishedFinal(classId) && !confirmed) throw new ConflictError("Gradebook sudah memiliki nilai published. Konfirmasi perubahan konfigurasi dan simpan audit terlebih dahulu");
}

async function categoryWeightTotal(classId: string, excludeId?: string) {
  const rows = await prisma.gradeCategory.findMany({ where: { classId, status: { not: "ARCHIVED" }, ...(excludeId ? { id: { not: excludeId } } : {}) }, select: { weight: true } });
  return rows.reduce((sum, row) => sum + Number(row.weight), 0);
}

export async function listGradebookClasses(actor: Actor) {
  requireGradebookFeature();
  if (actor.role !== "GURU") throw new ForbiddenError();
  const items = await prisma.kelas.findMany({ where: { status: "ACTIVE", guruProfile: { userId: actor.id } }, orderBy: { name: "asc" }, select: { id: true, name: true, program: { select: { name: true } }, level: { select: { name: true } } } });
  return { items };
}

export async function createGradeCategory(actor: Actor, classId: string, input: unknown) {
  await assertGuruClass(actor, classId);
  const parsed = gradeCategorySchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Data kategori gradebook belum valid", parsed.error.flatten().fieldErrors);
  if ((await categoryWeightTotal(classId)) + parsed.data.weight > 100.01) throw new ValidationError("Total bobot kategori tidak boleh melebihi 100%");
  const item = await prisma.$transaction(async (tx) => {
    const category = await tx.gradeCategory.create({ data: { classId, name: parsed.data.name, weight: parsed.data.weight, order: parsed.data.order, dropLowestCount: parsed.data.dropLowestCount, status: "DRAFT", createdById: actor.id }, select: { id: true, name: true, weight: true, order: true, dropLowestCount: true, status: true } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "GRADE_CATEGORY_CREATED", entityType: "GradeCategory", entityId: category.id, metadata: { classId, weight: parsed.data.weight } } });
    return category;
  });
  return { item: { ...item, weight: Number(item.weight) } };
}

export async function updateGradeCategory(actor: Actor, categoryId: string, input: unknown) {
  const parsed = updateGradeCategorySchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Data kategori gradebook belum valid", parsed.error.flatten().fieldErrors);
  const existing = await prisma.gradeCategory.findUnique({ where: { id: categoryId }, select: { id: true, classId: true, name: true, weight: true, order: true, dropLowestCount: true, status: true } });
  if (!existing) throw new NotFoundError("Kategori gradebook tidak ditemukan");
  await assertGuruClass(actor, existing.classId);
  await assertConfigurationChange(existing.classId, parsed.data.confirmPublishedChange === true);
  const weight = parsed.data.weight ?? Number(existing.weight);
  if ((await categoryWeightTotal(existing.classId, categoryId)) + weight > 100.01) throw new ValidationError("Total bobot kategori tidak boleh melebihi 100%");
  const item = await prisma.$transaction(async (tx) => {
    const category = await tx.gradeCategory.update({ where: { id: categoryId }, data: { ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}), ...(parsed.data.weight !== undefined ? { weight: parsed.data.weight } : {}), ...(parsed.data.order !== undefined ? { order: parsed.data.order } : {}), ...(parsed.data.dropLowestCount !== undefined ? { dropLowestCount: parsed.data.dropLowestCount } : {}) }, select: { id: true, name: true, weight: true, order: true, dropLowestCount: true, status: true } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "GRADE_CATEGORY_UPDATED", entityType: "GradeCategory", entityId: categoryId, metadata: { classId: existing.classId, confirmedPublishedChange: parsed.data.confirmPublishedChange === true } } });
    return category;
  });
  return { item: { ...item, weight: Number(item.weight) } };
}

export async function updateGradeCategoryStatus(actor: Actor, categoryId: string, input: unknown) {
  const parsed = updateGradeCategoryStatusSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Status kategori gradebook belum valid", parsed.error.flatten().fieldErrors);
  const existing = await prisma.gradeCategory.findUnique({ where: { id: categoryId }, select: { id: true, classId: true, status: true } });
  if (!existing) throw new NotFoundError("Kategori gradebook tidak ditemukan");
  await assertGuruClass(actor, existing.classId);
  await assertConfigurationChange(existing.classId, parsed.data.confirmPublishedChange === true);
  const item = await prisma.gradeCategory.update({ where: { id: categoryId }, data: { status: parsed.data.status }, select: { id: true, name: true, weight: true, order: true, dropLowestCount: true, status: true } });
  await prisma.auditLog.create({ data: { actorId: actor.id, action: `GRADE_CATEGORY_${parsed.data.status}`, entityType: "GradeCategory", entityId: categoryId, metadata: { previousStatus: existing.status } } });
  return { item: { ...item, weight: Number(item.weight) } };
}

async function validateGradeItemSource(classId: string, sourceType: SourceType, sourceId: string | null) {
  if (["ASSIGNMENT", "EXAM", "QUIZ"].includes(sourceType) && !sourceId) throw new ValidationError("Item sumber wajib memiliki sourceId");
  if (sourceType === "ASSIGNMENT" && sourceId) {
    const source = await prisma.assignment.findFirst({ where: { id: sourceId, kelasId: classId }, select: { id: true } });
    if (!source) throw new ValidationError("Assignment sumber tidak tersedia di kelas ini");
  }
  if (sourceType === "EXAM" && sourceId) {
    const source = await prisma.ujian.findFirst({ where: { id: sourceId, kelasId: classId }, select: { id: true } });
    if (!source) throw new ValidationError("Ujian sumber tidak tersedia di kelas ini");
  }
  if (sourceType === "QUIZ" && sourceId) throw new ValidationError("Sumber Quiz belum memiliki domain pada fase ini");
  if (!["ASSIGNMENT", "EXAM", "QUIZ"].includes(sourceType) && sourceId) throw new ValidationError("SourceId hanya boleh digunakan untuk sumber assessment");
}

export async function createGradeItem(actor: Actor, classId: string, input: unknown) {
  await assertGuruClass(actor, classId);
  const parsed = gradeItemSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Data item gradebook belum valid", parsed.error.flatten().fieldErrors);
  const sourceId = parsed.data.sourceId || null;
  await validateGradeItemSource(classId, parsed.data.sourceType, sourceId);
  const category = await prisma.gradeCategory.findFirst({ where: { id: parsed.data.categoryId, classId, status: { not: "ARCHIVED" } }, select: { id: true } });
  if (!category) throw new NotFoundError("Kategori gradebook tidak ditemukan");
  await assertConfigurationChange(classId, parsed.data.confirmPublishedChange === true);
  const existing = sourceId ? await prisma.gradeItem.findFirst({ where: { classId, sourceType: parsed.data.sourceType, sourceId }, select: { id: true } }) : null;
  if (existing) throw new ConflictError("Sumber ini sudah menjadi item gradebook di kelas tersebut");
  const item = await prisma.$transaction(async (tx) => {
    const created = await tx.gradeItem.create({ data: { classId, categoryId: parsed.data.categoryId, sourceType: parsed.data.sourceType, sourceId, title: parsed.data.title, order: parsed.data.order, maxScore: parsed.data.maxScore, weightOverride: parsed.data.weightOverride, isExtraCredit: parsed.data.isExtraCredit, status: "DRAFT", dueAt: parseDateTime(parsed.data.dueAt), createdById: actor.id }, select: { id: true, title: true, sourceType: true, sourceId: true, maxScore: true, status: true, categoryId: true } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "GRADE_ITEM_CREATED", entityType: "GradeItem", entityId: created.id, metadata: { classId, sourceType: parsed.data.sourceType, sourceId } } });
    return created;
  });
  return { item: { ...item, maxScore: Number(item.maxScore) } };
}

export async function updateGradeItemStatus(actor: Actor, itemId: string, input: unknown) {
  const parsed = updateGradeItemStatusSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Status item gradebook belum valid", parsed.error.flatten().fieldErrors);
  const existing = await prisma.gradeItem.findUnique({ where: { id: itemId }, select: { id: true, classId: true, category: { select: { status: true } }, status: true, sourceType: true, sourceId: true } });
  if (!existing) throw new NotFoundError("Item gradebook tidak ditemukan");
  await assertGuruClass(actor, existing.classId);
  await assertConfigurationChange(existing.classId, parsed.data.confirmPublishedChange === true);
  if (parsed.data.status === "PUBLISHED" && existing.category.status !== "PUBLISHED") throw new ConflictError("Kategori harus dipublikasikan sebelum item gradebook");
  const item = await prisma.gradeItem.update({ where: { id: itemId }, data: { status: parsed.data.status }, select: { id: true, title: true, sourceType: true, sourceId: true, maxScore: true, status: true, categoryId: true } });
  await prisma.auditLog.create({ data: { actorId: actor.id, action: `GRADE_ITEM_${parsed.data.status}`, entityType: "GradeItem", entityId: itemId, metadata: { previousStatus: existing.status } } });
  if (parsed.data.status === "PUBLISHED" || parsed.data.status === "LOCKED") await syncGradeItemById(itemId);
  return { item: { ...item, maxScore: Number(item.maxScore) } };
}

async function getActiveStudentIds(classId: string) {
  const rows = await prisma.kelasSiswa.findMany({ where: { kelasId: classId, status: "ACTIVE", siswa: { status: "ACTIVE", deletedAt: null } }, select: { siswaId: true } });
  return rows.map((row) => row.siswaId);
}

function normalize(rawScore: number | null, maxScore: number) {
  if (rawScore === null || maxScore <= 0) return null;
  return roundScore(Math.max(0, Math.min(100, (rawScore / maxScore) * 100)));
}

async function buildAssignmentSourceEntries(classId: string, sourceId: string, itemMaxScore: number): Promise<SourceEntry[]> {
  const assignment = await prisma.assignment.findFirst({
    where: { id: sourceId, kelasId: classId },
    select: {
      id: true,
      maxScore: true,
      submissions: {
        orderBy: [{ studentId: "asc" }, { attemptNumber: "desc" }],
        select: {
          studentId: true,
          status: true,
          isLate: true,
          grades: { where: { status: "PUBLISHED" }, orderBy: { createdAt: "desc" }, take: 1, select: { id: true, score: true, feedbackText: true, updatedAt: true } },
        },
      },
    },
  });
  if (!assignment) throw new NotFoundError("Assignment sumber tidak ditemukan");
  const studentIds = await getActiveStudentIds(classId);
  const latest = new Map<string, (typeof assignment.submissions)[number]>();
  for (const submission of assignment.submissions) if (!latest.has(submission.studentId)) latest.set(submission.studentId, submission);
  return studentIds.map((studentId) => {
    const submission = latest.get(studentId);
    const grade = submission?.grades[0];
    if (grade && grade.score !== null) return { studentId, rawScore: Number(grade.score), normalizedScore: normalize(Number(grade.score), Number(assignment.maxScore) || itemMaxScore), status: "GRADED", isLate: Boolean(submission?.isLate), feedbackSummary: grade.feedbackText, sourceVersion: `${grade.id}:${grade.updatedAt.toISOString()}` };
    if (submission && submission.status !== "DRAFT") return { studentId, rawScore: null, normalizedScore: null, status: "SUBMITTED", isLate: Boolean(submission.isLate || submission.status === "LATE"), feedbackSummary: null, sourceVersion: `submission:${submission.studentId}:${submission.status}` };
    return { studentId, rawScore: null, normalizedScore: null, status: "MISSING", isLate: false, feedbackSummary: null, sourceVersion: null };
  });
}

async function buildExamSourceEntries(classId: string, sourceId: string): Promise<SourceEntry[]> {
  const exam = await prisma.ujian.findFirst({ where: { id: sourceId, kelasId: classId }, select: { id: true, results: { where: { status: { in: ["FINAL", "CORRECTED"] } }, orderBy: { updatedAt: "desc" }, select: { siswaId: true, status: true, totalScore: true, updatedAt: true } } } });
  if (!exam) throw new NotFoundError("Ujian sumber tidak ditemukan");
  const studentIds = await getActiveStudentIds(classId);
  const latest = new Map<string, (typeof exam.results)[number]>();
  for (const result of exam.results) if (!latest.has(result.siswaId)) latest.set(result.siswaId, result);
  return studentIds.map((studentId) => {
    const result = latest.get(studentId);
    if (result && result.totalScore !== null) return { studentId, rawScore: Number(result.totalScore), normalizedScore: normalize(Number(result.totalScore), 100), status: "FINAL", isLate: false, feedbackSummary: null, sourceVersion: `${result.siswaId}:${result.updatedAt.toISOString()}` };
    return { studentId, rawScore: null, normalizedScore: null, status: "MISSING", isLate: false, feedbackSummary: null, sourceVersion: null };
  });
}

export async function syncGradeItemById(itemId: string) {
  const item = await prisma.gradeItem.findUnique({ where: { id: itemId }, select: { id: true, classId: true, sourceType: true, sourceId: true, maxScore: true, status: true } });
  if (!item) throw new NotFoundError("Item gradebook tidak ditemukan");
  if (!item.sourceId || !["ASSIGNMENT", "EXAM"].includes(item.sourceType)) return { synced: false, count: 0 };
  const sourceEntries = item.sourceType === "ASSIGNMENT" ? await buildAssignmentSourceEntries(item.classId, item.sourceId, Number(item.maxScore)) : await buildExamSourceEntries(item.classId, item.sourceId);
  const existing = await prisma.gradeEntry.findMany({ where: { gradeItemId: itemId }, select: { id: true, studentId: true, status: true } });
  const existingByStudent = new Map(existing.map((entry) => [entry.studentId, entry]));
  await prisma.$transaction(async (tx) => {
    for (const entry of sourceEntries) {
      const previous = existingByStudent.get(entry.studentId);
      if (previous && ["EXEMPT", "REMEDIAL"].includes(previous.status)) continue;
      await tx.gradeEntry.upsert({ where: { gradeItemId_studentId: { gradeItemId: itemId, studentId: entry.studentId } }, create: { gradeItemId: itemId, studentId: entry.studentId, rawScore: entry.rawScore, normalizedScore: entry.normalizedScore, status: entry.status, isLate: entry.isLate, feedbackSummary: entry.feedbackSummary, sourceVersion: entry.sourceVersion }, update: { rawScore: entry.rawScore, normalizedScore: entry.normalizedScore, status: entry.status, isLate: entry.isLate, feedbackSummary: entry.feedbackSummary, sourceVersion: entry.sourceVersion } });
    }
  });
  return { synced: true, count: sourceEntries.length };
}

export async function syncGradebookForSource(sourceType: "ASSIGNMENT" | "EXAM", sourceId: string) {
  const items = await prisma.gradeItem.findMany({ where: { sourceType, sourceId, status: { in: ["PUBLISHED", "LOCKED"] } }, select: { id: true } });
  for (const item of items) await syncGradeItemById(item.id);
  return { count: items.length };
}

async function syncClassSources(classId: string) {
  const items = await prisma.gradeItem.findMany({ where: { classId, status: { in: ["PUBLISHED", "LOCKED"] }, sourceType: { in: ["ASSIGNMENT", "EXAM"] }, sourceId: { not: null } }, select: { id: true } });
  for (const item of items) await syncGradeItemById(item.id);
}

function scoreStatus(status: string) {
  return ["GRADED", "FINAL", "REMEDIAL"].includes(status);
}

function calculateCategory(category: { id: string; name: string; weight: unknown; dropLowestCount: number; items: GradebookItem[] }, studentId: string) {
  const itemResults = category.items.map((item) => {
    const entry = item.entries.find((candidate) => candidate.studentId === studentId);
    return { item, entry, normalizedScore: toNumber(entry?.normalizedScore), status: entry?.status || "MISSING" };
  });
  const regular = itemResults.filter((result) => !result.item.isExtraCredit && scoreStatus(result.status) && result.normalizedScore !== null);
  const dropIds = new Set(regular.slice().sort((left, right) => (left.normalizedScore || 0) - (right.normalizedScore || 0)).slice(0, category.dropLowestCount).map((result) => result.item.id));
  const counted = regular.filter((result) => !dropIds.has(result.item.id));
  const hasExplicitWeight = counted.some((result) => result.item.weightOverride !== null);
  const equalWeight = counted.length ? 100 / counted.length : 0;
  const denominator = counted.reduce((sum, result) => sum + (hasExplicitWeight ? (toNumber(result.item.weightOverride) || 0) : equalWeight), 0);
  const weighted = counted.reduce((sum, result) => sum + (result.normalizedScore || 0) * (hasExplicitWeight ? (toNumber(result.item.weightOverride) || 0) : equalWeight), 0);
  const extraCredit = itemResults.filter((result) => result.item.isExtraCredit && scoreStatus(result.status) && result.normalizedScore !== null).reduce((sum, result) => sum + (result.normalizedScore || 0) * ((toNumber(result.item.weightOverride) || 0) / 100), 0);
  const score = denominator > 0 ? roundScore((weighted / denominator) + extraCredit) : null;
  const incomplete = category.items.length > 0 && itemResults.some((result) => ["MISSING", "SUBMITTED"].includes(result.status));
  return { id: category.id, name: category.name, weight: Number(category.weight), score, incomplete, items: itemResults.map((result) => ({ id: result.item.id, title: result.item.title, sourceType: result.item.sourceType, sourceId: result.item.sourceId, maxScore: toNumber(result.item.maxScore) || 0, normalizedScore: result.normalizedScore, rawScore: toNumber(result.entry?.rawScore), status: result.status, isLate: Boolean(result.entry?.isLate), feedbackSummary: result.entry?.feedbackSummary || null, isExtraCredit: result.item.isExtraCredit })) };
}

function letterGrade(score: number | null) {
  if (score === null) return null;
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "E";
}

async function loadGradebook(classId: string, studentIds: string[], includeDrafts: boolean) {
  const categories = await prisma.gradeCategory.findMany({ where: { classId, ...(includeDrafts ? { status: { not: "ARCHIVED" } } : { status: "PUBLISHED" }) }, orderBy: { order: "asc" }, select: { id: true, name: true, weight: true, dropLowestCount: true, status: true, items: { where: includeDrafts ? { status: { in: ["PUBLISHED", "LOCKED"] } } : { status: { in: ["PUBLISHED", "LOCKED"] } }, orderBy: { order: "asc" }, select: { id: true, categoryId: true, sourceType: true, sourceId: true, title: true, order: true, maxScore: true, weightOverride: true, isExtraCredit: true, status: true, dueAt: true, entries: { where: { studentId: { in: studentIds } }, select: { studentId: true, rawScore: true, normalizedScore: true, status: true, isLate: true, feedbackSummary: true, sourceVersion: true } } } } } });
  const students = await prisma.siswa.findMany({ where: { id: { in: studentIds } }, orderBy: { name: "asc" }, select: { id: true, name: true, nomorInduk: true } });
  const finals = await prisma.finalGrade.findMany({ where: { classId, studentId: { in: studentIds }, ...(includeDrafts ? {} : { status: { in: ["PUBLISHED", "LOCKED", "CORRECTED"] } }) }, select: { id: true, studentId: true, calculatedScore: true, publishedScore: true, letterGrade: true, completionStatus: true, status: true, publishedAt: true, updatedAt: true } });
  const finalByStudent = new Map(finals.map((finalGrade) => [finalGrade.studentId, finalGrade]));
  const weightTotal = categories.reduce((sum, category) => sum + Number(category.weight), 0);
  const rows = students.map((student) => {
    const categoryRows = categories.map((category) => calculateCategory(category, student.id));
    const availableCategories = categoryRows.filter((category) => category.score !== null);
    const activeWeight = availableCategories.reduce((sum, category) => sum + category.weight, 0);
    const calculatedScore = activeWeight > 0 ? roundScore(availableCategories.reduce((sum, category) => sum + (category.score || 0) * category.weight, 0) / activeWeight) : null;
    const complete = weightTotal >= 99.99 && weightTotal <= 100.01 && categories.length > 0 && categoryRows.every((category) => !category.incomplete && category.items.length > 0);
    return { student, categories: categoryRows, calculatedScore, letterGrade: letterGrade(calculatedScore), completionStatus: complete ? "COMPLETE" : "INCOMPLETE", finalGrade: finalByStudent.get(student.id) || null };
  });
  return { categories: categories.map((category) => ({ id: category.id, name: category.name, weight: Number(category.weight), dropLowestCount: category.dropLowestCount, status: category.status, itemCount: category.items.length })), items: categories.flatMap((category) => category.items.map((item) => ({ id: item.id, categoryId: category.id, categoryName: category.name, sourceType: item.sourceType, sourceId: item.sourceId, title: item.title, order: item.order, maxScore: Number(item.maxScore), weightOverride: toNumber(item.weightOverride), isExtraCredit: item.isExtraCredit, status: item.status, dueAt: item.dueAt }))), rows, weightTotal: roundScore(weightTotal) || 0 };
}

export async function getGuruGradebook(actor: Actor, classId: string) {
  await assertGuruClass(actor, classId);
  await syncClassSources(classId);
  return loadGradebook(classId, await getActiveStudentIds(classId), true);
}

export async function getStudentGradebook(actor: Actor, classId: string) {
  const studentId = await assertStudentClass(actor, classId);
  await syncClassSources(classId);
  return loadGradebook(classId, [studentId], false);
}

export async function getWaliGradebook(actor: Actor, studentId: string, classId: string) {
  await assertWaliClass(actor, studentId, classId);
  await syncClassSources(classId);
  return loadGradebook(classId, [studentId], false);
}

export async function saveGradeEntry(actor: Actor, itemId: string, input: unknown) {
  const parsed = gradeEntrySchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Data entry gradebook belum valid", parsed.error.flatten().fieldErrors);
  const item = await prisma.gradeItem.findUnique({ where: { id: itemId }, select: { id: true, classId: true, sourceType: true, maxScore: true, status: true } });
  if (!item) throw new NotFoundError("Item gradebook tidak ditemukan");
  await assertGuruClass(actor, item.classId);
  if (item.status === "LOCKED") throw new ConflictError("Item gradebook sudah terkunci");
  if (item.sourceType !== "MANUAL") throw new ConflictError("Entry dari Assignment/Ujian hanya dapat diubah melalui sumber assessment");
  const enrollment = await prisma.kelasSiswa.findFirst({ where: { kelasId: item.classId, siswaId: parsed.data.studentId, status: "ACTIVE" }, select: { id: true } });
  if (!enrollment) throw new ValidationError("Siswa tidak aktif di kelas gradebook");
  if (parsed.data.rawScore !== undefined && parsed.data.rawScore > Number(item.maxScore)) throw new ValidationError("Skor tidak boleh melebihi nilai maksimal item");
  if (["GRADED", "REMEDIAL", "FINAL"].includes(parsed.data.status) && parsed.data.rawScore === undefined) throw new ValidationError("Status nilai ini wajib memiliki skor");
  const rawScore = ["MISSING", "SUBMITTED", "EXEMPT"].includes(parsed.data.status) ? null : parsed.data.rawScore ?? null;
  const normalizedScore = parsed.data.status === "EXEMPT" ? null : normalize(rawScore, Number(item.maxScore));
  const entry = await prisma.$transaction(async (tx) => {
    const result = await tx.gradeEntry.upsert({ where: { gradeItemId_studentId: { gradeItemId: itemId, studentId: parsed.data.studentId } }, create: { gradeItemId: itemId, studentId: parsed.data.studentId, rawScore, normalizedScore, status: parsed.data.status, isLate: parsed.data.isLate, feedbackSummary: parsed.data.feedbackSummary || null, sourceVersion: parsed.data.sourceVersion || `manual:${Date.now()}` }, update: { rawScore, normalizedScore, status: parsed.data.status, isLate: parsed.data.isLate, feedbackSummary: parsed.data.feedbackSummary || null, sourceVersion: parsed.data.sourceVersion || `manual:${Date.now()}` } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "GRADE_ENTRY_SAVED", entityType: "GradeEntry", entityId: result.id, metadata: { gradeItemId: itemId, studentId: parsed.data.studentId, status: parsed.data.status } } });
    return result;
  });
  return { item: { ...entry, rawScore: toNumber(entry.rawScore), normalizedScore: toNumber(entry.normalizedScore) } };
}

async function notifyStudentFinalGrade(studentId: string, classId: string, finalGradeId: string, score: number | null, notificationKey: string) {
  const account = await prisma.siswaAccount.findUnique({ where: { siswaId: studentId }, select: { user: { select: { email: true } } } });
  if (!account) return;
  try {
    await prisma.notifikasi.create({ data: { channel: "in_app", template: "gradebook-final-published", recipient: account.user.email, subject: "Nilai akhir tersedia", body: `Nilai akhir gradebook kelas sudah tersedia${score === null ? "" : ` dengan skor ${score}`}.`, dedupeKey: createHash("sha256").update(`gradebook-final-published|${finalGradeId}|${notificationKey}|${account.user.email}`).digest("hex"), metadata: { finalGradeId, classId, studentId } } });
  } catch (error) {
    if (!(error && typeof error === "object" && "code" in error && error.code === "P2002")) throw error;
  }
}

export async function publishFinalGrades(actor: Actor, classId: string, input: unknown) {
  await assertGuruClass(actor, classId);
  const parsed = publishFinalGradesSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Data publish nilai akhir belum valid", parsed.error.flatten().fieldErrors);
  await syncClassSources(classId);
  const gradebook = await loadGradebook(classId, await getActiveStudentIds(classId), false);
  if (gradebook.weightTotal < 99.99 || gradebook.weightTotal > 100.01) throw new ValidationError("Total bobot kategori harus tepat 100% sebelum nilai akhir dipublikasikan");
  const selectedRows = parsed.data.studentIds?.length ? gradebook.rows.filter((row) => parsed.data.studentIds?.includes(row.student.id)) : gradebook.rows;
  if (selectedRows.length === 0) throw new ValidationError("Tidak ada siswa yang dipilih");
  if (selectedRows.some((row) => row.completionStatus !== "COMPLETE" || row.calculatedScore === null)) throw new ConflictError("Masih ada komponen MISSING atau SUBMITTED yang harus diselesaikan atau ditandai EXEMPT");
  const published = await prisma.$transaction(async (tx) => {
    const results = [];
    for (const row of selectedRows) {
      const existing = await tx.finalGrade.findUnique({ where: { classId_studentId: { classId, studentId: row.student.id } }, select: { id: true, status: true, publishedScore: true, calculatedScore: true } });
      if (existing?.status === "LOCKED") throw new ConflictError("Nilai akhir yang terkunci tidak dapat diubah");
      const changed = existing && Number(existing.publishedScore ?? existing.calculatedScore ?? 0) !== Number(row.calculatedScore);
      if (changed && !(parsed.data.correctionReason || "").trim()) throw new ValidationError("Koreksi nilai akhir published wajib memiliki alasan", { correctionReason: ["Alasan koreksi wajib diisi"] });
      const item = existing ? await tx.finalGrade.update({ where: { id: existing.id }, data: { calculatedScore: row.calculatedScore, publishedScore: row.calculatedScore, letterGrade: row.letterGrade, completionStatus: "COMPLETE", status: changed ? "CORRECTED" : "PUBLISHED", publishedAt: new Date() }, select: { id: true, studentId: true, calculatedScore: true, publishedScore: true, letterGrade: true, completionStatus: true, status: true, publishedAt: true } }) : await tx.finalGrade.create({ data: { classId, studentId: row.student.id, calculatedScore: row.calculatedScore, publishedScore: row.calculatedScore, letterGrade: row.letterGrade, completionStatus: "COMPLETE", status: "PUBLISHED", publishedAt: new Date() }, select: { id: true, studentId: true, calculatedScore: true, publishedScore: true, letterGrade: true, completionStatus: true, status: true, publishedAt: true } });
      await tx.auditLog.create({ data: { actorId: actor.id, action: changed ? "FINAL_GRADE_CORRECTED" : "FINAL_GRADE_PUBLISHED", entityType: "FinalGrade", entityId: item.id, reason: changed ? parsed.data.correctionReason : undefined, metadata: { classId, studentId: row.student.id, beforeScore: existing?.publishedScore?.toString() ?? null, afterScore: row.calculatedScore } } });
      results.push(item);
    }
    return results;
  });
  const studentIds = published.map((item) => item.studentId);
  const notificationKey = published.map((item) => `${item.id}:${item.status}:${item.publishedScore?.toString() ?? ""}`).join(",");
  await notifyWaliForStudents({ siswaIds: studentIds, template: "gradebook-final-published", subject: "Nilai akhir tersedia", body: "Nilai akhir gradebook anak sudah tersedia di menu Nilai.", dedupeKey: notificationKey, metadata: { classId, count: published.length } });
  for (const item of published) await notifyStudentFinalGrade(item.studentId, classId, item.id, Number(item.publishedScore), `${item.status}:${item.publishedScore?.toString() ?? ""}`);
  return { items: published.map((item) => ({ ...item, calculatedScore: toNumber(item.calculatedScore), publishedScore: toNumber(item.publishedScore) })) };
}
