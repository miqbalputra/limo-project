import "server-only";

import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import type { Actor } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/errors/application-error";
import { requireFeature } from "@/server/features/feature-flags";
import { canAccessStudent, canManageClass } from "@/server/policies/access-policy";
import { notifyWaliForStudents } from "@/server/services/notification-service";
import { createRubricSchema, attachRubricSchema, saveSubmissionGradeSchema, updateRubricSchema, updateRubricStatusSchema } from "@/server/validation/rubric";

type RubricSnapshot = {
  templateId: string;
  title: string;
  criteria: Array<{
    id: string;
    name: string;
    description: string | null;
    maxScore: number;
    order: number;
    levels: Array<{ id: string; label: string; description: string | null; score: number; order: number }>;
  }>;
};

function requireRubricFeature() {
  requireFeature("assignmentsEnabled", "Rubrik tugas belum diaktifkan");
}

async function assertGuruClass(actor: Actor, kelasId: string) {
  requireRubricFeature();
  if (actor.role !== "GURU" || !(await canManageClass(actor, kelasId))) throw new ForbiddenError("Anda tidak memiliki akses mengelola rubrik kelas ini");
}

async function assertRubricOwner(actor: Actor, rubricId: string) {
  requireRubricFeature();
  if (actor.role !== "GURU") throw new ForbiddenError("Hanya Guru yang dapat mengelola rubrik");
  const rubric = await prisma.rubricTemplate.findUnique({ where: { id: rubricId }, select: { id: true, ownerUserId: true, status: true, _count: { select: { criteria: true } } } });
  if (!rubric) throw new NotFoundError("Rubrik tidak ditemukan");
  if (rubric.ownerUserId !== actor.id) throw new ForbiddenError("Rubrik ini bukan milik Anda");
  return rubric;
}

function toInputJson(value: unknown) {
  return value as Prisma.InputJsonValue;
}

function buildSnapshot(rubric: { id: string; title: string; criteria: Array<{ id: string; name: string; description: string | null; maxScore: number; order: number; levels: Array<{ id: string; label: string; description: string | null; score: number; order: number }> }> }): RubricSnapshot {
  return { templateId: rubric.id, title: rubric.title, criteria: rubric.criteria.map((criterion) => ({ id: criterion.id, name: criterion.name, description: criterion.description, maxScore: criterion.maxScore, order: criterion.order, levels: criterion.levels.map((level) => ({ id: level.id, label: level.label, description: level.description, score: level.score, order: level.order })) })) };
}

export async function listRubrics(actor: Actor) {
  requireRubricFeature();
  if (actor.role !== "GURU") throw new ForbiddenError();
  const items = await prisma.rubricTemplate.findMany({
    where: { OR: [{ ownerUserId: actor.id }, { status: "PUBLISHED", scope: "INSTITUTION" }] },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    select: { id: true, title: true, description: true, scope: true, status: true, updatedAt: true, criteria: { orderBy: { order: "asc" }, select: { id: true, name: true, maxScore: true, order: true, levels: { orderBy: { order: "asc" }, select: { id: true, label: true, score: true, order: true } } } } },
  });
  return { items };
}

export async function createRubric(actor: Actor, input: unknown) {
  requireRubricFeature();
  if (actor.role !== "GURU") throw new ForbiddenError();
  const parsed = createRubricSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Data rubrik belum valid", parsed.error.flatten().fieldErrors);
  for (const criterion of parsed.data.criteria) {
    if (criterion.levels.some((level) => level.score > criterion.maxScore)) throw new ValidationError("Skor level tidak boleh melebihi skor maksimal kriteria");
  }
  const item = await prisma.$transaction(async (tx) => {
    const rubric = await tx.rubricTemplate.create({ data: { ownerUserId: actor.id, title: parsed.data.title, description: parsed.data.description || undefined, scope: parsed.data.scope, status: "DRAFT", criteria: { create: parsed.data.criteria.map((criterion) => ({ name: criterion.name, description: criterion.description || undefined, maxScore: criterion.maxScore, order: criterion.order, levels: { create: criterion.levels.map((level) => ({ label: level.label, description: level.description || undefined, score: level.score, order: level.order })) } })) } }, select: { id: true, title: true, status: true } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "RUBRIC_CREATED", entityType: "RubricTemplate", entityId: rubric.id } });
    return rubric;
  });
  return { item };
}

export async function updateRubricStatus(actor: Actor, rubricId: string, input: unknown) {
  const parsed = updateRubricStatusSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Status rubrik belum valid", parsed.error.flatten().fieldErrors);
  const existing = await assertRubricOwner(actor, rubricId);
  if (parsed.data.status === "PUBLISHED" && existing._count.criteria === 0) throw new ValidationError("Rubrik harus memiliki minimal satu kriteria sebelum dipublikasikan");
  const item = await prisma.rubricTemplate.update({ where: { id: rubricId }, data: { status: parsed.data.status }, select: { id: true, title: true, status: true } });
  await prisma.auditLog.create({ data: { actorId: actor.id, action: `RUBRIC_${parsed.data.status}`, entityType: "RubricTemplate", entityId: rubricId, metadata: { previousStatus: existing.status } } });
  return { item };
}

export async function updateRubric(actor: Actor, rubricId: string, input: unknown) {
  requireRubricFeature();
  const parsed = updateRubricSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Data rubrik belum valid", parsed.error.flatten().fieldErrors);
  const existing = await assertRubricOwner(actor, rubricId);
  for (const criterion of parsed.data.criteria) {
    if (criterion.levels.some((level) => level.score > criterion.maxScore)) throw new ValidationError("Skor level tidak boleh melebihi skor maksimal kriteria");
  }
  const oldCriteria = await prisma.rubricCriterion.findMany({ where: { rubricId }, orderBy: { order: "asc" }, select: { id: true, levels: { orderBy: { order: "asc" }, select: { id: true } } } });
  if (oldCriteria.length !== parsed.data.criteria.length || oldCriteria.some((criterion, index) => criterion.levels.length !== parsed.data.criteria[index].levels.length)) throw new ConflictError("Edit rubrik hanya dapat mengubah isi level/kriteria yang sudah ada; jumlahnya harus tetap");
  const item = await prisma.$transaction(async (tx) => {
    for (const [criterionIndex, criterionInput] of parsed.data.criteria.entries()) {
      const criterion = oldCriteria[criterionIndex];
      await tx.rubricCriterion.update({ where: { id: criterion.id }, data: { name: criterionInput.name, description: criterionInput.description || null, maxScore: criterionInput.maxScore, order: criterionInput.order } });
      for (const [levelIndex, levelInput] of criterionInput.levels.entries()) await tx.rubricLevel.update({ where: { id: criterion.levels[levelIndex].id }, data: { label: levelInput.label, description: levelInput.description || null, score: levelInput.score, order: levelInput.order } });
    }
    const rubric = await tx.rubricTemplate.update({ where: { id: rubricId }, data: { title: parsed.data.title, description: parsed.data.description || null, scope: parsed.data.scope }, select: { id: true, title: true, status: true } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "RUBRIC_UPDATED", entityType: "RubricTemplate", entityId: rubricId, metadata: { previousStatus: existing.status } } });
    return rubric;
  });
  return { item };
}

export async function attachRubricToAssignment(actor: Actor, assignmentId: string, input: unknown) {
  const parsed = attachRubricSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Rubrik belum dipilih", parsed.error.flatten().fieldErrors);
  const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId }, select: { id: true, kelasId: true } });
  if (!assignment) throw new NotFoundError("Tugas tidak ditemukan");
  await assertGuruClass(actor, assignment.kelasId);
  const rubric = await prisma.rubricTemplate.findFirst({ where: { id: parsed.data.rubricId, OR: [{ ownerUserId: actor.id }, { status: "PUBLISHED", scope: "INSTITUTION" }] }, select: { id: true, title: true, status: true, criteria: { orderBy: { order: "asc" }, select: { id: true, name: true, description: true, maxScore: true, order: true, levels: { orderBy: { order: "asc" }, select: { id: true, label: true, description: true, score: true, order: true } } } } } });
  if (!rubric || rubric.status !== "PUBLISHED") throw new ConflictError("Rubrik harus dipublikasikan sebelum dipasang ke tugas");
  const snapshot = buildSnapshot(rubric);
  const item = await prisma.$transaction(async (tx) => {
    const updated = await tx.assignment.update({ where: { id: assignmentId }, data: { rubricTemplateId: rubric.id, rubricSnapshot: toInputJson(snapshot) }, select: { id: true, rubricTemplateId: true, rubricSnapshot: true } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "ASSIGNMENT_RUBRIC_ATTACHED", entityType: "Assignment", entityId: assignmentId, metadata: { rubricId: rubric.id } } });
    return updated;
  });
  return { item };
}

async function getSubmissionContext(actor: Actor, submissionId: string) {
  requireRubricFeature();
  const submission = await prisma.assignmentSubmission.findUnique({ where: { id: submissionId }, select: { id: true, studentId: true, status: true, assignment: { select: { id: true, title: true, kelasId: true, maxScore: true, rubricSnapshot: true } }, student: { select: { id: true, name: true, nomorInduk: true } }, files: { select: { id: true, originalName: true, mimeType: true, sizeBytes: true, mediaDuration: true, createdAt: true } }, grades: { orderBy: { createdAt: "desc" }, select: { id: true, rawScore: true, score: true, feedbackText: true, status: true, correctionReason: true, publishedAt: true, createdAt: true, criteria: { select: { id: true, criterionId: true, rubricLevelId: true, score: true, comment: true } } } } } });
  if (!submission) throw new NotFoundError("Submission tidak ditemukan");
  await assertGuruClass(actor, submission.assignment.kelasId);
  if (submission.status === "DRAFT") throw new ConflictError("Submission belum dikumpulkan");
  const rubricSnapshot = (submission.assignment.rubricSnapshot || null) as RubricSnapshot | null;
  if (!rubricSnapshot) throw new ConflictError("Tugas ini belum memiliki rubrik");
  return { submission, rubricSnapshot };
}

function validateGradeCriteria(snapshot: RubricSnapshot, assignmentMaxScore: number, input: Array<{ criterionId: string; rubricLevelId?: string; score: number; comment?: string }>) {
  const criteriaById = new Map(snapshot.criteria.map((criterion) => [criterion.id, criterion]));
  if (new Set(input.map((criterion) => criterion.criterionId)).size !== input.length || input.length !== snapshot.criteria.length) throw new ValidationError("Semua kriteria rubrik harus diisi tepat satu kali");
  let rawScore = 0;
  let maxScore = 0;
  for (const criterionInput of input) {
    const criterion = criteriaById.get(criterionInput.criterionId);
    if (!criterion) throw new ValidationError("Kriteria penilaian tidak berasal dari snapshot rubrik");
    if (criterionInput.score < 0 || criterionInput.score > criterion.maxScore) throw new ValidationError(`Skor kriteria ${criterion.name} di luar batas`);
    if (criterionInput.rubricLevelId && !criterion.levels.some((level) => level.id === criterionInput.rubricLevelId)) throw new ValidationError("Level rubrik tidak sesuai dengan kriteria");
    rawScore += criterionInput.score;
    maxScore += criterion.maxScore;
  }
  return { rawScore, score: maxScore > 0 ? Math.round((rawScore / maxScore) * assignmentMaxScore) : 0 };
}

export async function getSubmissionGradeContext(actor: Actor, submissionId: string) {
  const { submission, rubricSnapshot } = await getSubmissionContext(actor, submissionId);
  return { submission: { ...submission, files: submission.files.map((file) => ({ ...file, sizeBytes: file.sizeBytes.toString() })) }, rubricSnapshot, latestGrade: submission.grades[0] || null };
}

export async function saveSubmissionGrade(actor: Actor, submissionId: string, input: unknown) {
  const { submission, rubricSnapshot } = await getSubmissionContext(actor, submissionId);
  const parsed = saveSubmissionGradeSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Data penilaian belum valid", parsed.error.flatten().fieldErrors);
  const latestPublished = submission.grades.find((grade) => grade.status === "PUBLISHED");
  if (latestPublished && !(parsed.data.correctionReason || "").trim()) throw new ValidationError("Koreksi nilai published wajib memiliki alasan", { correctionReason: ["Alasan koreksi wajib diisi"] });
  const totals = validateGradeCriteria(rubricSnapshot, submission.assignment.maxScore, parsed.data.criteria);
  const grade = await prisma.$transaction(async (tx) => {
    const draft = await tx.submissionGrade.findFirst({ where: { submissionId, status: "DRAFT" }, orderBy: { createdAt: "desc" }, select: { id: true } });
    const current = draft ? await tx.submissionGrade.update({ where: { id: draft.id }, data: { graderUserId: actor.id, rawScore: totals.rawScore, score: totals.score, feedbackText: parsed.data.feedbackText || null, correctionReason: parsed.data.correctionReason || null }, select: { id: true } }) : await tx.submissionGrade.create({ data: { submissionId, graderUserId: actor.id, rawScore: totals.rawScore, score: totals.score, feedbackText: parsed.data.feedbackText || null, correctionReason: parsed.data.correctionReason || null, status: "DRAFT" }, select: { id: true } });
    await tx.criterionGrade.deleteMany({ where: { submissionGradeId: current.id } });
    await tx.criterionGrade.createMany({ data: parsed.data.criteria.map((criterion) => ({ submissionGradeId: current.id, criterionId: criterion.criterionId, rubricLevelId: criterion.rubricLevelId || null, score: criterion.score, comment: criterion.comment || null })) });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "SUBMISSION_GRADE_DRAFT_SAVED", entityType: "SubmissionGrade", entityId: current.id, metadata: { submissionId, rawScore: totals.rawScore, score: totals.score, correction: Boolean(latestPublished) } } });
    return tx.submissionGrade.findUniqueOrThrow({ where: { id: current.id }, select: { id: true, rawScore: true, score: true, feedbackText: true, status: true, correctionReason: true, publishedAt: true, createdAt: true, criteria: { select: { id: true, criterionId: true, rubricLevelId: true, score: true, comment: true } } } });
  });
  return { item: grade };
}

async function notifyStudentGrade(studentId: string, assignmentTitle: string, gradeId: string, score: number | null) {
  const account = await prisma.siswaAccount.findUnique({ where: { siswaId: studentId }, select: { user: { select: { email: true } } } });
  if (!account) return;
  try {
    await prisma.notifikasi.create({ data: { channel: "in_app", template: "assignment-grade-published", recipient: account.user.email, subject: `Feedback tugas: ${assignmentTitle}`, body: `Nilai dan feedback tugas ${assignmentTitle} sudah tersedia${score === null ? "" : ` dengan skor ${score}`}.`, dedupeKey: createHash("sha256").update(`assignment-grade-published|${gradeId}|${account.user.email}`).digest("hex"), metadata: { gradeId, studentId } } });
  } catch (error) {
    if (!(error && typeof error === "object" && "code" in error && error.code === "P2002")) throw error;
  }
}

export async function publishSubmissionGrade(actor: Actor, submissionId: string, gradeId: string) {
  const { submission } = await getSubmissionContext(actor, submissionId);
  const grade = await prisma.submissionGrade.findFirst({ where: { id: gradeId, submissionId, status: "DRAFT" }, select: { id: true, score: true, correctionReason: true, criteria: { select: { id: true } } } });
  if (!grade) throw new NotFoundError("Draft penilaian tidak ditemukan");
  if (grade.criteria.length === 0) throw new ValidationError("Penilaian belum memiliki kriteria");
  const previous = await prisma.submissionGrade.findFirst({ where: { submissionId, status: "PUBLISHED" }, orderBy: { createdAt: "desc" }, select: { id: true, score: true } });
  if (previous && !(grade.correctionReason || "").trim()) throw new ValidationError("Koreksi nilai published wajib memiliki alasan");
  const published = await prisma.$transaction(async (tx) => {
    const item = await tx.submissionGrade.update({ where: { id: grade.id }, data: { status: "PUBLISHED", publishedAt: new Date() }, select: { id: true, score: true, status: true, publishedAt: true } });
    if (previous) await tx.submissionGrade.update({ where: { id: previous.id }, data: { status: "REVISED" } });
    await tx.assignmentSubmission.update({ where: { id: submissionId }, data: { status: "GRADED" } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: previous ? "SUBMISSION_GRADE_CORRECTED" : "SUBMISSION_GRADE_PUBLISHED", entityType: "SubmissionGrade", entityId: grade.id, metadata: { submissionId, beforeScore: previous?.score ?? null, afterScore: item.score, correctionReason: grade.correctionReason || null } } });
    return item;
  });
  await notifyStudentGrade(submission.studentId, submission.assignment.title, published.id, published.score);
  await notifyWaliForStudents({ siswaIds: [submission.studentId], template: "assignment-grade-published", subject: `Feedback tugas: ${submission.assignment.title}`, body: `Nilai dan feedback tugas ${submission.assignment.title} sudah tersedia untuk anak.`, dedupeKey: published.id, metadata: { gradeId: published.id, assignmentId: submission.assignment.id } });
  return { item: published };
}

export async function getPublishedSubmissionGrade(submissionId: string) {
  const grade = await prisma.submissionGrade.findFirst({ where: { submissionId, status: "PUBLISHED" }, orderBy: { createdAt: "desc" }, select: { id: true, rawScore: true, score: true, feedbackText: true, status: true, publishedAt: true, criteria: { select: { id: true, criterionId: true, rubricLevelId: true, score: true, comment: true } } } });
  return grade;
}

export async function getStudentPublishedGrade(actor: Actor, submissionId: string) {
  requireRubricFeature();
  if (actor.role !== "SISWA") throw new ForbiddenError();
  const submission = await prisma.assignmentSubmission.findUnique({ where: { id: submissionId }, select: { studentId: true, assignment: { select: { status: true } } } });
  if (!submission || submission.assignment.status !== "PUBLISHED" || !(await canAccessStudent(actor, submission.studentId))) throw new ForbiddenError("Anda tidak memiliki akses ke nilai ini");
  return getPublishedSubmissionGrade(submissionId);
}
