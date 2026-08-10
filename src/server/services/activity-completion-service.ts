import "server-only";

import type { Actor } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/errors/application-error";
import { isFeatureEnabled, requireFeature } from "@/server/features/feature-flags";
import { canAccessStudent, canManageClass } from "@/server/policies/access-policy";
import { completionRuleSchema, manualCompletionSchema } from "@/server/validation/activity-completion";

type RuleType = "VIEWED" | "SUBMITTED" | "GRADED" | "PASSED" | "MANUAL";
type CompletionState = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";

type CompletionRuleView = {
  id: string;
  ruleType: RuleType;
  minimumScore: number | null;
  requiredDurationSeconds: number | null;
  isRequired: boolean;
};

export type ActivityCompletionView = {
  moduleItemId: string;
  status: CompletionState;
  completedAt: Date | null;
  completionSource: string | null;
  lastEvaluatedAt: Date | null;
  rules: CompletionRuleView[];
};

export type ModuleProgressView = {
  moduleId: string;
  moduleTitle: string;
  requiredItemCount: number;
  completedRequiredItemCount: number;
  progressPercentage: number;
  completedAt: Date | null;
  calculatedAt: Date;
  items: Array<ActivityCompletionView & { title: string; itemType: string; isRequired: boolean; order: number }>;
};

function requireCompletionFeature() {
  requireFeature("activityCompletionEnabled", "Activity completion belum diaktifkan");
  requireFeature("learningModulesEnabled", "Modul pembelajaran belum diaktifkan");
}

function internalCompletionEnabled() {
  return isFeatureEnabled("activityCompletionEnabled") && isFeatureEnabled("learningModulesEnabled");
}

function defaultRuleType(itemType: string): RuleType {
  if (itemType === "MATERIAL") return "VIEWED";
  if (itemType === "ASSIGNMENT") return "SUBMITTED";
  if (itemType === "EXAM") return "GRADED";
  return "MANUAL";
}

function tokens(value: string | null | undefined) {
  return new Set((value || "").split("|").map((item) => item.trim()).filter(Boolean));
}

function sourceToken(ruleType: RuleType) {
  return ruleType;
}

function toRuleView(rule: { id: string; ruleType: RuleType; minimumScore: unknown; requiredDurationSeconds: number | null; isRequired: boolean }): CompletionRuleView {
  return { id: rule.id, ruleType: rule.ruleType, minimumScore: rule.minimumScore === null ? null : Number(rule.minimumScore), requiredDurationSeconds: rule.requiredDurationSeconds, isRequired: rule.isRequired };
}

async function getModuleItem(itemId: string) {
  return prisma.moduleItem.findUnique({ where: { id: itemId }, select: { id: true, moduleId: true, itemType: true, entityId: true, isRequired: true, archivedAt: true, availableFrom: true, availableUntil: true, module: { select: { id: true, kelasId: true, title: true, status: true, releaseAt: true } }, completionRules: { orderBy: { createdAt: "asc" }, select: { id: true, ruleType: true, minimumScore: true, requiredDurationSeconds: true, isRequired: true } } } });
}

export async function ensureDefaultCompletionRule(itemId: string) {
  if (!internalCompletionEnabled()) return null;
  const item = await prisma.moduleItem.findUnique({ where: { id: itemId }, select: { id: true, itemType: true, isRequired: true, completionRules: { select: { id: true } } } });
  if (!item || item.completionRules.length > 0) return item?.completionRules[0] || null;
  try {
    return await prisma.completionRule.create({ data: { moduleItemId: item.id, ruleType: defaultRuleType(item.itemType), isRequired: item.isRequired }, select: { id: true, ruleType: true, minimumScore: true, requiredDurationSeconds: true, isRequired: true } });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") return prisma.completionRule.findFirst({ where: { moduleItemId: item.id }, select: { id: true, ruleType: true, minimumScore: true, requiredDurationSeconds: true, isRequired: true } });
    throw error;
  }
}

async function ensureRules(itemId: string) {
  await ensureDefaultCompletionRule(itemId);
  return prisma.completionRule.findMany({ where: { moduleItemId: itemId }, orderBy: { createdAt: "asc" }, select: { id: true, ruleType: true, minimumScore: true, requiredDurationSeconds: true, isRequired: true } });
}

async function getActiveStudentIds(classId: string, studentId?: string) {
  const enrollments = await prisma.kelasSiswa.findMany({ where: { kelasId: classId, status: "ACTIVE", ...(studentId ? { siswaId: studentId } : {}), siswa: { status: "ACTIVE", deletedAt: null } }, select: { siswaId: true } });
  return enrollments.map((item) => item.siswaId);
}

type SourceEvaluation = { started: boolean; submitted: boolean; graded: boolean; score: number | null };

async function loadSourceEvaluations(item: { itemType: string; entityId: string }, studentIds: string[]) {
  const result = new Map<string, SourceEvaluation>();
  for (const studentId of studentIds) result.set(studentId, { started: false, submitted: false, graded: false, score: null });
  if (item.itemType === "ASSIGNMENT") {
    const source = await prisma.assignment.findUnique({ where: { id: item.entityId }, select: { maxScore: true, submissions: { where: { studentId: { in: studentIds } }, orderBy: [{ studentId: "asc" }, { attemptNumber: "desc" }], select: { studentId: true, status: true, grades: { where: { status: "PUBLISHED" }, orderBy: { createdAt: "desc" }, take: 1, select: { score: true } } } } } });
    if (!source) return result;
    for (const submission of source.submissions) {
      if (result.get(submission.studentId)?.started) continue;
      const grade = submission.grades[0];
      const submitted = ["SUBMITTED", "LATE", "GRADED"].includes(submission.status);
      const graded = Boolean(grade && grade.score !== null);
      const score = graded && grade?.score !== null ? Math.max(0, Math.min(100, (Number(grade.score) / Math.max(source.maxScore, 1)) * 100)) : null;
      result.set(submission.studentId, { started: true, submitted, graded, score });
    }
  } else if (item.itemType === "EXAM") {
    const source = await prisma.ujian.findUnique({ where: { id: item.entityId }, select: { results: { where: { siswaId: { in: studentIds } }, orderBy: { updatedAt: "desc" }, select: { siswaId: true, status: true, totalScore: true } }, attempts: { where: { siswaId: { in: studentIds } }, orderBy: [{ siswaId: "asc" }, { updatedAt: "desc" }], select: { siswaId: true, status: true } } } });
    if (!source) return result;
    for (const attempt of source.attempts) {
      if (result.get(attempt.siswaId)?.started) continue;
      result.set(attempt.siswaId, { started: true, submitted: ["FINAL", "NEEDS_REVIEW"].includes(attempt.status), graded: false, score: null });
    }
    for (const examResult of source.results) {
      const current = result.get(examResult.siswaId) || { started: false, submitted: false, graded: false, score: null };
      const graded = ["FINAL", "CORRECTED"].includes(examResult.status) && examResult.totalScore !== null;
      result.set(examResult.siswaId, { started: true, submitted: true, graded, score: graded ? Math.max(0, Math.min(100, Number(examResult.totalScore))) : current.score });
    }
  }
  return result;
}

async function isTargetPublished(item: { itemType: string; entityId: string }) {
  if (item.itemType === "MATERIAL") return Boolean(await prisma.materi.findFirst({ where: { id: item.entityId, status: "PUBLISHED" }, select: { id: true } }));
  if (item.itemType === "ASSIGNMENT") return Boolean(await prisma.assignment.findFirst({ where: { id: item.entityId, status: "PUBLISHED" }, select: { id: true } }));
  if (item.itemType === "EXAM") return Boolean(await prisma.ujian.findFirst({ where: { id: item.entityId, status: "PUBLISHED" }, select: { id: true } }));
  if (item.itemType === "CLASS_SESSION") return Boolean(await prisma.sesiKelas.findFirst({ where: { id: item.entityId, status: { not: "CANCELLED" } }, select: { id: true } }));
  return false;
}

function ruleFulfilled(rule: { ruleType: RuleType; minimumScore: unknown }, evaluation: SourceEvaluation, existingTokens: Set<string>) {
  if (rule.ruleType === "VIEWED" || rule.ruleType === "MANUAL") return existingTokens.has(sourceToken(rule.ruleType));
  if (rule.ruleType === "SUBMITTED") return evaluation.submitted;
  if (rule.ruleType === "GRADED") return evaluation.graded;
  return evaluation.graded && evaluation.score !== null && evaluation.score >= Number(rule.minimumScore ?? 60);
}

async function recalculateModuleProgress(moduleId: string, studentId: string, actorId?: string) {
  const items = await prisma.moduleItem.findMany({ where: { moduleId, archivedAt: null }, orderBy: [{ order: "asc" }, { createdAt: "asc" }], select: { id: true, isRequired: true } });
  const requiredItemIds = items.filter((item) => item.isRequired).map((item) => item.id);
  const completions = await prisma.studentActivityCompletion.findMany({ where: { moduleItemId: { in: requiredItemIds }, studentId }, select: { moduleItemId: true, status: true } });
  const completedRequiredItemCount = completions.filter((item) => item.status === "COMPLETED").length;
  const requiredItemCount = requiredItemIds.length;
  const progressPercentage = requiredItemCount > 0 ? Math.round((completedRequiredItemCount / requiredItemCount) * 10000) / 100 : 0;
  const completedAt = requiredItemCount > 0 && completedRequiredItemCount === requiredItemCount ? new Date() : null;
  const existing = await prisma.studentModuleProgress.findUnique({ where: { studentId_moduleId: { studentId, moduleId } }, select: { id: true, progressPercentage: true } });
  const progress = await prisma.studentModuleProgress.upsert({ where: { studentId_moduleId: { studentId, moduleId } }, create: { studentId, moduleId, requiredItemCount, completedRequiredItemCount, progressPercentage, completedAt, calculatedAt: new Date() }, update: { requiredItemCount, completedRequiredItemCount, progressPercentage, completedAt, calculatedAt: new Date() }, select: { id: true, studentId: true, moduleId: true, requiredItemCount: true, completedRequiredItemCount: true, progressPercentage: true, completedAt: true, calculatedAt: true } });
  if (existing && Number(existing.progressPercentage) !== progressPercentage) await prisma.auditLog.create({ data: { actorId, action: "STUDENT_MODULE_PROGRESS_RECALCULATED", entityType: "StudentModuleProgress", entityId: progress.id, metadata: { moduleId, studentId, before: Number(existing.progressPercentage), after: progressPercentage } } });
  return progress;
}

export async function recalculateModuleItemCompletion(moduleItemId: string, options: { studentId?: string; actorId?: string } = {}) {
  if (!internalCompletionEnabled()) return { updated: 0 };
  const item = await getModuleItem(moduleItemId);
  if (!item) throw new NotFoundError("Aktivitas modul tidak ditemukan");
  const rules = await ensureRules(moduleItemId);
  const studentIds = await getActiveStudentIds(item.module.kelasId, options.studentId);
  const evaluations = await loadSourceEvaluations(item, studentIds);
  const existing = await prisma.studentActivityCompletion.findMany({ where: { moduleItemId, studentId: { in: studentIds } }, select: { id: true, studentId: true, status: true, completedAt: true, completionSource: true, completedByUserId: true, evidenceEntityId: true } });
  const existingByStudent = new Map(existing.map((row) => [row.studentId, row]));
  let updated = 0;
  for (const studentId of studentIds) {
    const previous = existingByStudent.get(studentId);
    const evaluation = evaluations.get(studentId) || { started: false, submitted: false, graded: false, score: null };
    const completionTokens = tokens(previous?.completionSource);
    for (const rule of rules) {
      if (rule.ruleType === "VIEWED" || rule.ruleType === "MANUAL") continue;
      if (ruleFulfilled(rule, evaluation, completionTokens)) completionTokens.add(sourceToken(rule.ruleType));
      else completionTokens.delete(sourceToken(rule.ruleType));
    }
    const requiredRules = rules.filter((rule) => rule.isRequired);
    const completed = requiredRules.length > 0 && requiredRules.every((rule) => ruleFulfilled(rule, evaluation, completionTokens));
    const started = evaluation.started || completionTokens.size > 0;
    const status: CompletionState = completed ? "COMPLETED" : started ? "IN_PROGRESS" : "NOT_STARTED";
    const source = completionTokens.size > 0 ? [...completionTokens].sort().join("|") : null;
    const completedAt = status === "COMPLETED" ? previous?.completedAt || new Date() : null;
    const row = await prisma.studentActivityCompletion.upsert({ where: { studentId_moduleItemId: { studentId, moduleItemId } }, create: { studentId, moduleItemId, status, completedAt, completionSource: source, completedByUserId: previous?.completedByUserId, evidenceEntityId: item.entityId, lastEvaluatedAt: new Date() }, update: { status, completedAt, completionSource: source, completedByUserId: previous?.completedByUserId, evidenceEntityId: item.entityId, lastEvaluatedAt: new Date() }, select: { id: true, status: true, completedAt: true } });
    if (!previous || previous.status !== status) {
      await prisma.auditLog.create({ data: { actorId: options.actorId, action: "ACTIVITY_COMPLETION_UPDATED", entityType: "StudentActivityCompletion", entityId: row.id, metadata: { moduleItemId, studentId, before: previous?.status || "NOT_STARTED", after: status, source } } });
    }
    await recalculateModuleProgress(item.moduleId, studentId, options.actorId);
    updated += 1;
  }
  return { updated };
}

export async function syncActivityCompletionForAssignment(assignmentId: string, studentId?: string) {
  if (!internalCompletionEnabled()) return { items: 0, updated: 0 };
  const items = await prisma.moduleItem.findMany({ where: { itemType: "ASSIGNMENT", entityId: assignmentId }, select: { id: true } });
  let updated = 0;
  for (const item of items) updated += (await recalculateModuleItemCompletion(item.id, { studentId })).updated;
  return { items: items.length, updated };
}

export async function syncActivityCompletionForExam(examId: string, studentId?: string) {
  if (!internalCompletionEnabled()) return { items: 0, updated: 0 };
  const items = await prisma.moduleItem.findMany({ where: { itemType: "EXAM", entityId: examId }, select: { id: true } });
  let updated = 0;
  for (const item of items) updated += (await recalculateModuleItemCompletion(item.id, { studentId })).updated;
  return { items: items.length, updated };
}

export async function upsertCompletionRule(actor: Actor, itemId: string, input: unknown) {
  requireCompletionFeature();
  const parsed = completionRuleSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Aturan completion belum valid", parsed.error.flatten().fieldErrors);
  const item = await getModuleItem(itemId);
  if (!item) throw new NotFoundError("Aktivitas modul tidak ditemukan");
  if (actor.role !== "GURU" || !(await canManageClass(actor, item.module.kelasId))) throw new ForbiddenError("Anda tidak memiliki akses mengelola aturan completion ini");
  if (parsed.data.ruleType !== "PASSED" && parsed.data.minimumScore !== undefined) throw new ValidationError("minimumScore hanya berlaku untuk rule PASSED");
  const rule = await prisma.$transaction(async (tx) => {
    const result = await tx.completionRule.upsert({ where: { moduleItemId_ruleType: { moduleItemId: itemId, ruleType: parsed.data.ruleType } }, create: { moduleItemId: itemId, ruleType: parsed.data.ruleType, minimumScore: parsed.data.minimumScore, requiredDurationSeconds: parsed.data.requiredDurationSeconds, isRequired: parsed.data.isRequired }, update: { minimumScore: parsed.data.minimumScore, requiredDurationSeconds: parsed.data.requiredDurationSeconds, isRequired: parsed.data.isRequired }, select: { id: true, ruleType: true, minimumScore: true, requiredDurationSeconds: true, isRequired: true } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "COMPLETION_RULE_UPDATED", entityType: "CompletionRule", entityId: result.id, metadata: { moduleItemId: itemId, ruleType: result.ruleType, isRequired: result.isRequired } } });
    return result;
  });
  await recalculateModuleItemCompletion(itemId, { actorId: actor.id });
  return { item: toRuleView(rule) };
}

export async function markModuleItemViewed(actor: Actor, kelasId: string, moduleId: string, itemId: string) {
  requireCompletionFeature();
  if (actor.role !== "SISWA") throw new ForbiddenError("Hanya Siswa yang dapat menandai aktivitas dilihat");
  const account = await prisma.siswaAccount.findUnique({ where: { userId: actor.id }, select: { siswaId: true, status: true, siswa: { select: { status: true, deletedAt: true } } } });
  if (!account || account.status !== "ACTIVE" || account.siswa.status !== "ACTIVE" || account.siswa.deletedAt) throw new ForbiddenError("Akun Siswa belum aktif");
  const enrollment = await prisma.kelasSiswa.findFirst({ where: { kelasId, siswaId: account.siswaId, status: "ACTIVE", kelas: { status: "ACTIVE" } }, select: { id: true } });
  if (!enrollment) throw new NotFoundError("Kelas tidak ditemukan");
  const item = await getModuleItem(itemId);
  const now = new Date();
  if (!item || item.moduleId !== moduleId || item.module.kelasId !== kelasId || item.archivedAt || item.module.status !== "PUBLISHED" || (item.module.releaseAt && item.module.releaseAt > now) || (item.availableFrom && item.availableFrom > now) || (item.availableUntil && item.availableUntil < now) || !(await isTargetPublished(item))) throw new NotFoundError("Aktivitas modul tidak tersedia");
  const source = await prisma.moduleItem.findUnique({ where: { id: itemId }, select: { prerequisiteItemId: true } });
  if (source?.prerequisiteItemId) {
    const prerequisiteCompletion = await prisma.studentActivityCompletion.findUnique({ where: { studentId_moduleItemId: { studentId: account.siswaId, moduleItemId: source.prerequisiteItemId } }, select: { status: true } });
    if (prerequisiteCompletion?.status !== "COMPLETED") throw new ConflictError("Selesaikan prasyarat aktivitas terlebih dahulu");
  }
  const current = await prisma.studentActivityCompletion.findUnique({ where: { studentId_moduleItemId: { studentId: account.siswaId, moduleItemId: itemId } }, select: { completionSource: true } });
  const completionTokens = tokens(current?.completionSource);
  completionTokens.add("VIEWED");
  await prisma.studentActivityCompletion.upsert({ where: { studentId_moduleItemId: { studentId: account.siswaId, moduleItemId: itemId } }, create: { studentId: account.siswaId, moduleItemId: itemId, status: "IN_PROGRESS", completionSource: [...completionTokens].sort().join("|"), evidenceEntityId: item.entityId, lastEvaluatedAt: new Date() }, update: { completionSource: [...completionTokens].sort().join("|"), status: "IN_PROGRESS", evidenceEntityId: item.entityId, lastEvaluatedAt: new Date() } });
  await prisma.auditLog.create({ data: { actorId: actor.id, action: "ACTIVITY_VIEWED", entityType: "ModuleItem", entityId: itemId, metadata: { moduleId, kelasId, studentId: account.siswaId } } });
  await recalculateModuleItemCompletion(itemId, { studentId: account.siswaId, actorId: actor.id });
  return { success: true };
}

export async function markManualCompletion(actor: Actor, classId: string, studentId: string, itemId: string, input: unknown) {
  requireCompletionFeature();
  const parsed = manualCompletionSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Completion manual belum valid", parsed.error.flatten().fieldErrors);
  if (actor.role !== "GURU" || !(await canManageClass(actor, classId))) throw new ForbiddenError("Anda tidak memiliki akses menandai completion kelas ini");
  const item = await getModuleItem(itemId);
  if (!item || item.module.kelasId !== classId) throw new NotFoundError("Aktivitas modul tidak ditemukan");
  const enrollment = await prisma.kelasSiswa.findFirst({ where: { kelasId: classId, siswaId: studentId, status: "ACTIVE" }, select: { id: true } });
  if (!enrollment) throw new ValidationError("Siswa tidak aktif di kelas ini");
  const current = await prisma.studentActivityCompletion.findUnique({ where: { studentId_moduleItemId: { studentId, moduleItemId: itemId } }, select: { completionSource: true } });
  const completionTokens = tokens(current?.completionSource);
  if (parsed.data.completed) completionTokens.add("MANUAL"); else completionTokens.delete("MANUAL");
  await prisma.studentActivityCompletion.upsert({ where: { studentId_moduleItemId: { studentId, moduleItemId: itemId } }, create: { studentId, moduleItemId: itemId, status: parsed.data.completed ? "IN_PROGRESS" : "NOT_STARTED", completionSource: completionTokens.size ? [...completionTokens].sort().join("|") : null, completedByUserId: parsed.data.completed ? actor.id : null, evidenceEntityId: item.entityId, lastEvaluatedAt: new Date() }, update: { completionSource: completionTokens.size ? [...completionTokens].sort().join("|") : null, completedByUserId: parsed.data.completed ? actor.id : null, status: parsed.data.completed ? "IN_PROGRESS" : "NOT_STARTED", lastEvaluatedAt: new Date() } });
  await prisma.auditLog.create({ data: { actorId: actor.id, action: "ACTIVITY_COMPLETION_MANUAL", entityType: "StudentActivityCompletion", entityId: itemId, reason: parsed.data.reason, metadata: { itemId, studentId, completed: parsed.data.completed } } });
  await recalculateModuleItemCompletion(itemId, { studentId, actorId: actor.id });
  return { success: true };
}

async function targetTitles(items: Array<{ itemType: string; entityId: string; titleOverride: string | null }>) {
  const materialIds = items.filter((item) => item.itemType === "MATERIAL").map((item) => item.entityId);
  const assignmentIds = items.filter((item) => item.itemType === "ASSIGNMENT").map((item) => item.entityId);
  const examIds = items.filter((item) => item.itemType === "EXAM").map((item) => item.entityId);
  const sessionIds = items.filter((item) => item.itemType === "CLASS_SESSION").map((item) => item.entityId);
  const [materials, assignments, exams, sessions] = await Promise.all([
    prisma.materi.findMany({ where: { id: { in: materialIds } }, select: { id: true, title: true } }),
    prisma.assignment.findMany({ where: { id: { in: assignmentIds } }, select: { id: true, title: true } }),
    prisma.ujian.findMany({ where: { id: { in: examIds } }, select: { id: true, title: true } }),
    prisma.sesiKelas.findMany({ where: { id: { in: sessionIds } }, select: { id: true, meetingNumber: true, topic: true } }),
  ]);
  const map = new Map<string, string>();
  materials.forEach((item) => map.set(`MATERIAL:${item.id}`, item.title));
  assignments.forEach((item) => map.set(`ASSIGNMENT:${item.id}`, item.title));
  exams.forEach((item) => map.set(`EXAM:${item.id}`, item.title));
  sessions.forEach((item) => map.set(`CLASS_SESSION:${item.id}`, `Pertemuan ${item.meetingNumber}: ${item.topic}`));
  return items.map((item) => item.titleOverride || map.get(`${item.itemType}:${item.entityId}`) || "Aktivitas tidak ditemukan");
}

async function getModuleProgressView(moduleId: string, studentId: string): Promise<ModuleProgressView> {
  const learningModule = await prisma.learningModule.findUnique({ where: { id: moduleId }, select: { id: true, title: true, items: { where: { archivedAt: null }, orderBy: [{ order: "asc" }, { createdAt: "asc" }], select: { id: true, itemType: true, entityId: true, titleOverride: true, order: true, isRequired: true, completionRules: { orderBy: { createdAt: "asc" }, select: { id: true, ruleType: true, minimumScore: true, requiredDurationSeconds: true, isRequired: true } }, activityCompletions: { where: { studentId }, select: { moduleItemId: true, status: true, completedAt: true, completionSource: true, lastEvaluatedAt: true } } } }, progress: { where: { studentId }, select: { requiredItemCount: true, completedRequiredItemCount: true, progressPercentage: true, completedAt: true, calculatedAt: true } } } });
  if (!learningModule) throw new NotFoundError("Modul tidak ditemukan");
  const titles = await targetTitles(learningModule.items);
  const progress = learningModule.progress[0];
  return { moduleId: learningModule.id, moduleTitle: learningModule.title, requiredItemCount: progress?.requiredItemCount || 0, completedRequiredItemCount: progress?.completedRequiredItemCount || 0, progressPercentage: progress ? Number(progress.progressPercentage) : 0, completedAt: progress?.completedAt || null, calculatedAt: progress?.calculatedAt || new Date(), items: learningModule.items.map((item, index) => { const completion = item.activityCompletions[0]; return { moduleItemId: item.id, title: titles[index], itemType: item.itemType, isRequired: item.isRequired, order: item.order, status: completion?.status || "NOT_STARTED", completedAt: completion?.completedAt || null, completionSource: completion?.completionSource || null, lastEvaluatedAt: completion?.lastEvaluatedAt || null, rules: item.completionRules.map(toRuleView) }; }) };
}

async function assertStudentEnrollment(actor: Actor, studentId: string, classId: string) {
  if (actor.role !== "SISWA") throw new ForbiddenError("Akses completion ini hanya tersedia untuk Siswa");
  const account = await prisma.siswaAccount.findUnique({ where: { userId: actor.id }, select: { siswaId: true, status: true } });
  if (!account || account.status !== "ACTIVE" || account.siswaId !== studentId) throw new ForbiddenError("Completion hanya dapat diubah untuk akun sendiri");
  const enrollment = await prisma.kelasSiswa.findFirst({ where: { siswaId: studentId, kelasId: classId, status: "ACTIVE", kelas: { status: "ACTIVE" } }, select: { id: true } });
  if (!enrollment) throw new NotFoundError("Kelas tidak ditemukan");
}

export async function getStudentModuleProgress(actor: Actor, classId: string, moduleId?: string) {
  requireCompletionFeature();
  const account = await prisma.siswaAccount.findUnique({ where: { userId: actor.id }, select: { siswaId: true, status: true, siswa: { select: { status: true, deletedAt: true } } } });
  if (!account || actor.role !== "SISWA" || account.status !== "ACTIVE" || account.siswa.status !== "ACTIVE" || account.siswa.deletedAt) throw new ForbiddenError("Akun Siswa belum aktif");
  await assertStudentEnrollment(actor, account.siswaId, classId);
  const modules = await prisma.learningModule.findMany({ where: { ...(moduleId ? { id: moduleId } : {}), kelasId: classId, status: "PUBLISHED", OR: [{ releaseAt: null }, { releaseAt: { lte: new Date() } }] }, select: { id: true } });
  const progress: ModuleProgressView[] = [];
  for (const learningModule of modules) {
    const items = await prisma.moduleItem.findMany({ where: { moduleId: learningModule.id, archivedAt: null }, select: { id: true } });
    for (const item of items) await ensureDefaultCompletionRule(item.id);
    await Promise.all(items.map((item) => recalculateModuleItemCompletion(item.id, { studentId: account.siswaId })));
    await recalculateModuleProgress(learningModule.id, account.siswaId);
    progress.push(await getModuleProgressView(learningModule.id, account.siswaId));
  }
  return { studentId: account.siswaId, modules: progress };
}

export async function getWaliModuleProgress(actor: Actor, studentId: string, classId: string, moduleId?: string) {
  requireCompletionFeature();
  if (actor.role !== "WALI" || !(await canAccessStudent(actor, studentId))) throw new ForbiddenError("Anda tidak memiliki akses ke progres aktivitas siswa ini");
  const enrollment = await prisma.kelasSiswa.findFirst({ where: { siswaId: studentId, kelasId: classId, status: "ACTIVE", kelas: { status: "ACTIVE" } }, select: { id: true } });
  if (!enrollment) throw new NotFoundError("Kelas tidak ditemukan");
  const modules = await prisma.learningModule.findMany({ where: { ...(moduleId ? { id: moduleId } : {}), kelasId: classId, status: "PUBLISHED", OR: [{ releaseAt: null }, { releaseAt: { lte: new Date() } }] }, select: { id: true } });
  const progress: ModuleProgressView[] = [];
  for (const learningModule of modules) {
    const items = await prisma.moduleItem.findMany({ where: { moduleId: learningModule.id, archivedAt: null }, select: { id: true } });
    for (const item of items) await ensureDefaultCompletionRule(item.id);
    await Promise.all(items.map((item) => recalculateModuleItemCompletion(item.id, { studentId })));
    await recalculateModuleProgress(learningModule.id, studentId);
    progress.push(await getModuleProgressView(learningModule.id, studentId));
  }
  return { studentId, modules: progress };
}

export async function getGuruActivityMatrix(actor: Actor, classId: string) {
  requireCompletionFeature();
  if (actor.role !== "GURU" || !(await canManageClass(actor, classId))) throw new ForbiddenError("Anda tidak memiliki akses ke progres aktivitas kelas ini");
  const modules = await prisma.learningModule.findMany({ where: { kelasId: classId, status: { not: "ARCHIVED" } }, orderBy: [{ order: "asc" }, { createdAt: "asc" }], select: { id: true, title: true, items: { where: { archivedAt: null }, orderBy: [{ order: "asc" }, { createdAt: "asc" }], select: { id: true, titleOverride: true, itemType: true, entityId: true, order: true, isRequired: true, completionRules: { select: { id: true, ruleType: true, minimumScore: true, requiredDurationSeconds: true, isRequired: true } } } } } });
  const students = await prisma.siswa.findMany({ where: { enrollments: { some: { kelasId: classId, status: "ACTIVE" } }, status: "ACTIVE", deletedAt: null }, orderBy: { name: "asc" }, select: { id: true, name: true, nomorInduk: true } });
  for (const learningModule of modules) for (const item of learningModule.items) await ensureDefaultCompletionRule(item.id);
  for (const student of students) for (const learningModule of modules) await Promise.all(learningModule.items.map((item) => recalculateModuleItemCompletion(item.id, { studentId: student.id })));
  const itemIds = modules.flatMap((learningModule) => learningModule.items.map((item) => item.id));
  const rules = await prisma.completionRule.findMany({ where: { moduleItemId: { in: itemIds } }, orderBy: { createdAt: "asc" }, select: { id: true, moduleItemId: true, ruleType: true, minimumScore: true, requiredDurationSeconds: true, isRequired: true } });
  const rulesByItem = new Map<string, typeof rules>();
  for (const rule of rules) rulesByItem.set(rule.moduleItemId, [...(rulesByItem.get(rule.moduleItemId) || []), rule]);
  const completions = await prisma.studentActivityCompletion.findMany({ where: { studentId: { in: students.map((student) => student.id) }, moduleItemId: { in: itemIds } }, select: { studentId: true, moduleItemId: true, status: true, completedAt: true, completionSource: true, lastEvaluatedAt: true } });
  const completionByKey = new Map(completions.map((item) => [`${item.studentId}:${item.moduleItemId}`, item]));
  const progress = await prisma.studentModuleProgress.findMany({ where: { studentId: { in: students.map((student) => student.id) }, moduleId: { in: modules.map((module) => module.id) } }, select: { studentId: true, moduleId: true, requiredItemCount: true, completedRequiredItemCount: true, progressPercentage: true, completedAt: true, calculatedAt: true } });
  const progressByKey = new Map(progress.map((item) => [`${item.studentId}:${item.moduleId}`, item]));
  const titles = new Map<string, string>();
  for (const learningModule of modules) {
    const moduleTitles = await targetTitles(learningModule.items);
    learningModule.items.forEach((item, index) => titles.set(item.id, moduleTitles[index]));
  }
  return { classId, modules: modules.map((learningModule) => ({ id: learningModule.id, title: learningModule.title, items: learningModule.items.map((item) => ({ ...item, title: titles.get(item.id) || "Aktivitas tidak ditemukan", rules: (rulesByItem.get(item.id) || item.completionRules).map(toRuleView) })) })), rows: students.map((student) => ({ student, modules: modules.map((learningModule) => { const itemProgress = progressByKey.get(`${student.id}:${learningModule.id}`); return { moduleId: learningModule.id, requiredItemCount: itemProgress?.requiredItemCount || 0, completedRequiredItemCount: itemProgress?.completedRequiredItemCount || 0, progressPercentage: itemProgress ? Number(itemProgress.progressPercentage) : 0, items: learningModule.items.map((item) => ({ moduleItemId: item.id, status: completionByKey.get(`${student.id}:${item.id}`)?.status || "NOT_STARTED", completionSource: completionByKey.get(`${student.id}:${item.id}`)?.completionSource || null, completedAt: completionByKey.get(`${student.id}:${item.id}`)?.completedAt || null })) }; }) })) };
}
