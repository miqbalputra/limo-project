import "server-only";

import type { Prisma } from "@prisma/client";
import type { Actor } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/errors/application-error";
import { isFeatureEnabled, requireFeature } from "@/server/features/feature-flags";
import { canAccessStudent, canManageClass } from "@/server/policies/access-policy";
import { notifySiswaForStudents, notifyWaliForStudents } from "@/server/services/notification-service";
import { applyRemedialScorePolicy, type RemedialScorePolicy } from "@/server/services/remedial-score-policy";
import { createRemedialSchema, updateRemedialStatusSchema } from "@/server/validation/remedial";

function requireRemedialFeatures() {
  requireFeature("remedialEnabled", "Remedial belum diaktifkan");
  requireFeature("assignmentsEnabled", "Tugas online belum diaktifkan");
}

function parseDateTime(value: string | undefined, field: string) {
  if (!value) return undefined;
  const normalized = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? `${value}:00+07:00` : value;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) throw new ValidationError(`Tanggal ${field} belum valid`, { [field]: [`Tanggal ${field} belum valid`] });
  return parsed;
}

async function assertGuruClass(actor: Actor, kelasId: string) {
  requireRemedialFeatures();
  if (actor.role !== "GURU" || !(await canManageClass(actor, kelasId))) throw new ForbiddenError("Anda tidak memiliki akses mengelola remedial kelas ini");
}

async function getPublishedAssignment(classId: string, assignmentId: string) {
  const assignment = await prisma.assignment.findFirst({ where: { id: assignmentId, kelasId: classId, status: "PUBLISHED" }, select: { id: true, kelasId: true, title: true, maxScore: true, status: true } });
  if (!assignment) throw new ValidationError("Remedial hanya dapat memakai tugas published dari kelas yang sama");
  return assignment;
}

async function getStudentAccount(actor: Actor) {
  const account = await prisma.siswaAccount.findUnique({ where: { userId: actor.id }, select: { siswaId: true, status: true, siswa: { select: { status: true, deletedAt: true } } } });
  if (actor.role !== "SISWA" || !account || account.status !== "ACTIVE" || account.siswa.status !== "ACTIVE" || account.siswa.deletedAt) throw new ForbiddenError("Akun Siswa belum aktif");
  return account.siswaId;
}

async function sourceTitles(sourceIds: string[]) {
  const assignments = await prisma.assignment.findMany({ where: { id: { in: sourceIds } }, select: { id: true, title: true } });
  return new Map(assignments.map((assignment) => [assignment.id, assignment.title]));
}

function serializeRemedial<T extends { scoreCap: unknown }>(item: T) {
  return { ...item, scoreCap: item.scoreCap === null ? null : Number(item.scoreCap) };
}

function isUniqueConstraintError(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "P2002");
}

function normalizeScore(rawScore: number | null, maxScore: number) {
  if (rawScore === null || maxScore <= 0) return null;
  return Math.round(Math.max(0, Math.min(100, (rawScore / maxScore) * 100)) * 100) / 100;
}

const remedialSelect = {
  id: true,
  sourceType: true,
  sourceId: true,
  kelasId: true,
  title: true,
  instructions: true,
  availableFrom: true,
  dueAt: true,
  scorePolicy: true,
  scoreCap: true,
  status: true,
  idempotencyKey: true,
  createdById: true,
  createdAt: true,
  participants: {
    select: {
      id: true,
      studentId: true,
      reason: true,
      status: true,
      originalSubmissionId: true,
      originalScore: true,
      remedialScore: true,
      effectiveScore: true,
    },
  },
} satisfies Prisma.RemedialAssignmentSelect;

async function captureOriginalScores(tx: Prisma.TransactionClient, assignmentId: string, maxScore: number, participants: Array<{ id: string; studentId: string }>) {
  const submissions = await tx.assignmentSubmission.findMany({
    where: { assignmentId, studentId: { in: participants.map((participant) => participant.studentId) }, remedialParticipantId: null, revisionRequestId: null, status: { in: ["SUBMITTED", "LATE", "GRADED"] } },
    orderBy: [{ studentId: "asc" }, { attemptNumber: "desc" }],
    select: { id: true, studentId: true, grades: { where: { status: "PUBLISHED" }, orderBy: { createdAt: "desc" }, take: 1, select: { score: true } } },
  });
  const byStudent = new Map<string, (typeof submissions)[number]>();
  for (const submission of submissions) if (!byStudent.has(submission.studentId) && submission.grades[0]) byStudent.set(submission.studentId, submission);
  for (const participant of participants) {
    const submission = byStudent.get(participant.studentId);
    await tx.remedialParticipant.update({ where: { id: participant.id }, data: { originalSubmissionId: submission?.id ?? null, originalScore: submission?.grades[0]?.score === undefined ? null : normalizeScore(Number(submission.grades[0].score), maxScore) } });
  }
}

export async function createRemedialAssignment(actor: Actor, classId: string, input: unknown, idempotencyKey?: string | null) {
  await assertGuruClass(actor, classId);
  const parsed = createRemedialSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Data remedial belum valid", parsed.error.flatten().fieldErrors);
  if (parsed.data.sourceType !== "ASSIGNMENT") throw new ValidationError("Sumber remedial QUIZ, EXAM, dan COMPETENCY belum tersedia pada fase ini");
  if (parsed.data.scorePolicy === "CAPPED" && parsed.data.scoreCap === undefined) throw new ValidationError("Score cap wajib diisi untuk policy CAPPED");
  const normalizedIdempotencyKey = idempotencyKey?.trim().slice(0, 191) || null;
  if (normalizedIdempotencyKey) {
    const existing = await prisma.remedialAssignment.findUnique({ where: { idempotencyKey: normalizedIdempotencyKey }, select: remedialSelect });
    if (existing) {
      if (existing.kelasId !== classId || existing.createdById !== actor.id) throw new ConflictError("Idempotency-Key sudah dipakai untuk remedial lain");
      if (existing.status === "PUBLISHED") await notifyRemedialAssigned(existing.id, existing.title, existing.instructions, existing.dueAt, existing.participants.map((participant) => participant.studentId));
      return { item: serializeRemedial(existing), idempotent: true };
    }
  }
  const availableFrom = parseDateTime(parsed.data.availableFrom, "availableFrom");
  const dueAt = parseDateTime(parsed.data.dueAt, "dueAt");
  if (!dueAt) throw new ValidationError("Tenggat remedial wajib diisi");
  if (availableFrom && dueAt < availableFrom) throw new ValidationError("Tenggat remedial tidak boleh sebelum waktu tersedia");
  if (parsed.data.status === "PUBLISHED" && dueAt <= new Date()) throw new ValidationError("Tenggat remedial published harus berada di masa depan");
  const assignment = await getPublishedAssignment(classId, parsed.data.sourceId);
  const studentIds = [...new Set(parsed.data.participants.map((participant) => participant.studentId))];
  const enrollments = await prisma.kelasSiswa.findMany({ where: { kelasId: classId, siswaId: { in: studentIds }, status: "ACTIVE", siswa: { status: "ACTIVE", deletedAt: null } }, select: { siswaId: true } });
  if (enrollments.length !== studentIds.length) throw new ValidationError("Semua peserta remedial harus merupakan Siswa aktif di kelas ini");
  const reasonByStudent = new Map(parsed.data.participants.map((participant) => [participant.studentId, participant.reason]));
  const createItem = async () => prisma.$transaction(async (tx) => {
    const remedial = await tx.remedialAssignment.create({
      data: {
        sourceType: parsed.data.sourceType,
        sourceId: assignment.id,
        kelasId: classId,
        title: parsed.data.title,
        instructions: parsed.data.instructions,
        availableFrom: availableFrom || null,
        dueAt,
        scorePolicy: parsed.data.scorePolicy,
        scoreCap: parsed.data.scoreCap ?? null,
        status: parsed.data.status,
        idempotencyKey: normalizedIdempotencyKey,
        createdById: actor.id,
        participants: { create: studentIds.map((studentId) => ({ studentId, reason: reasonByStudent.get(studentId) || "Target belajar belum tercapai" })) },
      },
      select: { id: true, participants: { select: { id: true, studentId: true } } },
    });
    if (parsed.data.status === "PUBLISHED") await captureOriginalScores(tx, assignment.id, Number(assignment.maxScore), remedial.participants);
    await tx.auditLog.create({ data: { actorId: actor.id, action: "REMEDIAL_CREATED", entityType: "RemedialAssignment", entityId: remedial.id, metadata: { classId, sourceType: parsed.data.sourceType, sourceId: assignment.id, participantCount: studentIds.length, scorePolicy: parsed.data.scorePolicy } } });
    return tx.remedialAssignment.findUniqueOrThrow({ where: { id: remedial.id }, select: remedialSelect });
  });
  let item: Awaited<ReturnType<typeof createItem>>;
  let idempotent = false;
  try {
    item = await createItem();
  } catch (error) {
    if (!normalizedIdempotencyKey || !isUniqueConstraintError(error)) throw error;
    const existing = await prisma.remedialAssignment.findUnique({ where: { idempotencyKey: normalizedIdempotencyKey }, select: remedialSelect });
    if (!existing || existing.kelasId !== classId || existing.createdById !== actor.id) throw error;
    item = existing;
    idempotent = true;
  }
  if (item.status === "PUBLISHED") await notifyRemedialAssigned(item.id, item.title, item.instructions, item.dueAt, item.participants.map((participant) => participant.studentId));
  return { item: serializeRemedial(item), idempotent };
}

async function notifyRemedialAssigned(remedialId: string, title: string, instructions: string, dueAt: Date, studentIds: string[]) {
  await notifySiswaForStudents({ siswaIds: studentIds, template: "remedial-assigned", subject: `Remedial baru: ${title}`, body: `${title} tersedia sampai ${dueAt.toISOString()}. ${instructions.slice(0, 240)}`, dedupeKey: `${remedialId}:assigned`, metadata: { remedialId, dueAt: dueAt.toISOString() } });
  await notifyWaliForStudents({ siswaIds: studentIds, template: "remedial-assigned", subject: `Remedial anak: ${title}`, body: `Remedial ${title} sudah ditugaskan kepada anak dan memiliki tenggat ${dueAt.toISOString()}.`, dedupeKey: remedialId, metadata: { remedialId, dueAt: dueAt.toISOString() } });
}

export async function listGuruRemedials(actor: Actor, classId: string) {
  await assertGuruClass(actor, classId);
  const items = await prisma.remedialAssignment.findMany({ where: { kelasId: classId }, orderBy: [{ status: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }], select: { id: true, sourceType: true, sourceId: true, kelasId: true, title: true, instructions: true, availableFrom: true, dueAt: true, scorePolicy: true, scoreCap: true, status: true, createdAt: true, updatedAt: true, participants: { orderBy: { student: { name: "asc" } }, select: { id: true, studentId: true, reason: true, status: true, assignedAt: true, completedAt: true, originalScore: true, remedialScore: true, effectiveScore: true, resultPublishedAt: true, student: { select: { id: true, name: true, nomorInduk: true } } } } } });
  const titles = await sourceTitles(items.map((item) => item.sourceId));
  return { items: items.map((item) => ({ ...serializeRemedial(item), sourceTitle: titles.get(item.sourceId) || "Sumber tidak ditemukan", participants: item.participants.map((participant) => ({ ...participant, originalScore: participant.originalScore === null ? null : Number(participant.originalScore), remedialScore: participant.remedialScore === null ? null : Number(participant.remedialScore), effectiveScore: participant.effectiveScore === null ? null : Number(participant.effectiveScore) })) })) };
}

export async function updateRemedialStatus(actor: Actor, remedialId: string, input: unknown) {
  const parsed = updateRemedialStatusSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Status remedial belum valid", parsed.error.flatten().fieldErrors);
  const existing = await prisma.remedialAssignment.findUnique({ where: { id: remedialId }, select: { id: true, kelasId: true, sourceId: true, status: true, title: true, instructions: true, availableFrom: true, dueAt: true, participants: { select: { id: true, studentId: true, originalSubmissionId: true } } } });
  if (!existing) throw new NotFoundError("Remedial tidak ditemukan");
  await assertGuruClass(actor, existing.kelasId);
  if (parsed.data.status === "PUBLISHED" && existing.participants.length === 0) throw new ValidationError("Remedial harus memiliki minimal satu peserta");
  const publishing = parsed.data.status === "PUBLISHED" && existing.status !== "PUBLISHED";
  if (publishing && existing.dueAt <= new Date()) throw new ValidationError("Tenggat remedial published harus berada di masa depan");
  const item = await prisma.$transaction(async (tx) => {
    const updated = await tx.remedialAssignment.update({ where: { id: remedialId }, data: { status: parsed.data.status }, select: { id: true, sourceId: true, status: true, title: true, instructions: true, dueAt: true, participants: { select: { id: true, studentId: true } } } });
    if (parsed.data.status === "PUBLISHED" && existing.status === "DRAFT") {
      const assignment = await tx.assignment.findUniqueOrThrow({ where: { id: existing.sourceId }, select: { maxScore: true } });
      await captureOriginalScores(tx, existing.sourceId, Number(assignment.maxScore), updated.participants);
    }
    await tx.auditLog.create({ data: { actorId: actor.id, action: `REMEDIAL_${parsed.data.status}`, entityType: "RemedialAssignment", entityId: remedialId, metadata: { previousStatus: existing.status } } });
    return tx.remedialAssignment.findUniqueOrThrow({ where: { id: remedialId }, select: remedialSelect });
  });
  if (parsed.data.status === "PUBLISHED" && existing.status !== "PUBLISHED") await notifyRemedialAssigned(item.id, item.title, item.instructions, item.dueAt, item.participants.map((participant) => participant.studentId));
  return { item };
}

export async function getStudentRemedialContext(actor: Actor, remedialId: string, assignmentId?: string) {
  requireRemedialFeatures();
  const studentId = await getStudentAccount(actor);
  const now = new Date();
  const participant = await prisma.remedialParticipant.findFirst({ where: { id: remedialId, studentId, status: { in: ["ASSIGNED", "IN_PROGRESS", "SUBMITTED"] }, remedial: { status: "PUBLISHED", ...(assignmentId ? { sourceId: assignmentId } : {}) } }, select: { id: true, studentId: true, reason: true, status: true, assignedAt: true, completedAt: true, originalScore: true, remedialScore: true, effectiveScore: true, remedial: { select: { id: true, sourceType: true, sourceId: true, kelasId: true, title: true, instructions: true, availableFrom: true, dueAt: true, scorePolicy: true, scoreCap: true, status: true } } } });
  if (!participant || participant.remedial.sourceType !== "ASSIGNMENT") throw new NotFoundError("Remedial tidak ditemukan");
  if (participant.remedial.availableFrom && participant.remedial.availableFrom > now) throw new NotFoundError("Remedial belum tersedia");
  if (participant.remedial.dueAt < now) throw new ConflictError("Tenggat remedial sudah lewat");
  return { studentId, participant: { ...participant, originalScore: participant.originalScore === null ? null : Number(participant.originalScore), remedialScore: participant.remedialScore === null ? null : Number(participant.remedialScore), effectiveScore: participant.effectiveScore === null ? null : Number(participant.effectiveScore), remedial: serializeRemedial(participant.remedial) } };
}

export async function listStudentRemedials(actor: Actor) {
  requireRemedialFeatures();
  const studentId = await getStudentAccount(actor);
  const items = await prisma.remedialParticipant.findMany({ where: { studentId, status: { notIn: ["CANCELLED", "COMPLETED", "EXPIRED"] }, remedial: { status: "PUBLISHED", OR: [{ availableFrom: null }, { availableFrom: { lte: new Date() } }] } }, orderBy: [{ status: "asc" }, { remedial: { dueAt: "asc" } }], select: { id: true, reason: true, status: true, assignedAt: true, completedAt: true, originalScore: true, remedialScore: true, effectiveScore: true, remedial: { select: { id: true, sourceType: true, sourceId: true, kelasId: true, title: true, instructions: true, availableFrom: true, dueAt: true, scorePolicy: true, scoreCap: true, status: true, kelas: { select: { name: true } } } } } });
  return { items: items.map((item) => ({ ...item, originalScore: item.originalScore === null ? null : Number(item.originalScore), remedialScore: item.remedialScore === null ? null : Number(item.remedialScore), effectiveScore: item.effectiveScore === null ? null : Number(item.effectiveScore), remedial: serializeRemedial(item.remedial) })) };
}

export async function listWaliRemedials(actor: Actor, studentId: string, classId: string) {
  requireRemedialFeatures();
  if (actor.role !== "WALI" || !(await canAccessStudent(actor, studentId))) throw new ForbiddenError("Anda tidak memiliki akses ke remedial siswa ini");
  const enrollment = await prisma.kelasSiswa.findFirst({ where: { siswaId: studentId, kelasId: classId, status: "ACTIVE", kelas: { status: "ACTIVE" } }, select: { id: true } });
  if (!enrollment) throw new NotFoundError("Kelas tidak ditemukan");
  const items = await prisma.remedialParticipant.findMany({ where: { studentId, remedial: { kelasId: classId, status: "PUBLISHED" } }, orderBy: { remedial: { dueAt: "asc" } }, select: { id: true, reason: true, status: true, assignedAt: true, completedAt: true, originalScore: true, remedialScore: true, effectiveScore: true, remedial: { select: { id: true, sourceType: true, sourceId: true, kelasId: true, title: true, instructions: true, availableFrom: true, dueAt: true, scorePolicy: true, scoreCap: true, status: true } } } });
  return { items: items.map((item) => ({ ...item, originalScore: item.originalScore === null ? null : Number(item.originalScore), remedialScore: item.remedialScore === null ? null : Number(item.remedialScore), effectiveScore: item.effectiveScore === null ? null : Number(item.effectiveScore), remedial: serializeRemedial(item.remedial) })) };
}

export async function markRemedialInProgress(participantId: string) {
  await prisma.remedialParticipant.updateMany({ where: { id: participantId, status: "ASSIGNED" }, data: { status: "IN_PROGRESS" } });
}

export async function markRemedialSubmitted(participantId: string) {
  await prisma.remedialParticipant.updateMany({ where: { id: participantId, status: { in: ["ASSIGNED", "IN_PROGRESS"] } }, data: { status: "SUBMITTED" } });
}

export async function syncRemedialParticipantResult(participantId: string, actorId?: string) {
  if (!isFeatureEnabled("remedialEnabled")) return null;
  const participant = await prisma.remedialParticipant.findUnique({ where: { id: participantId }, select: { id: true, studentId: true, status: true, originalScore: true, remedialId: true, remedial: { select: { id: true, title: true, sourceType: true, sourceId: true, scorePolicy: true, scoreCap: true, status: true } } } });
  if (!participant || participant.remedial.sourceType !== "ASSIGNMENT" || participant.remedial.status !== "PUBLISHED") return null;
  const assignment = await prisma.assignment.findUnique({ where: { id: participant.remedial.sourceId }, select: { id: true, maxScore: true } });
  if (!assignment) return null;
  const remedialSubmission = await prisma.assignmentSubmission.findFirst({ where: { assignmentId: assignment.id, studentId: participant.studentId, remedialParticipantId: participant.id }, orderBy: { attemptNumber: "desc" }, select: { grades: { where: { status: "PUBLISHED" }, orderBy: { createdAt: "desc" }, take: 1, select: { id: true, score: true } } } });
  const remedialGrade = remedialSubmission?.grades[0];
  const originalNormalized = participant.originalScore === null ? null : Number(participant.originalScore);
  const remedialNormalized = remedialGrade?.score === undefined || remedialGrade.score === null ? null : normalizeScore(Number(remedialGrade.score), Math.max(Number(assignment.maxScore), 1));
  const effectiveNormalized = applyRemedialScorePolicy({ policy: participant.remedial.scorePolicy as RemedialScorePolicy, originalScore: originalNormalized, remedialScore: remedialNormalized, scoreCap: participant.remedial.scoreCap === null ? null : Number(participant.remedial.scoreCap) });
  const hasRemedialGrade = remedialNormalized !== null;
  const nextStatus = hasRemedialGrade ? "COMPLETED" : participant.status;
  const updated = await prisma.remedialParticipant.update({ where: { id: participant.id }, data: { originalScore: originalNormalized, remedialScore: remedialNormalized, effectiveScore: effectiveNormalized, status: nextStatus, completedAt: hasRemedialGrade ? new Date() : undefined, resultPublishedAt: hasRemedialGrade ? new Date() : undefined }, select: { id: true, studentId: true, status: true, originalScore: true, remedialScore: true, effectiveScore: true, completedAt: true, resultPublishedAt: true, remedial: { select: { id: true, title: true } } } });
  if (hasRemedialGrade) {
    await prisma.auditLog.create({ data: { actorId, action: "REMEDIAL_RESULT_PUBLISHED", entityType: "RemedialParticipant", entityId: participant.id, metadata: { remedialId: participant.remedialId, studentId: participant.studentId, originalScore: originalNormalized, remedialScore: remedialNormalized, effectiveScore: effectiveNormalized } } });
     await notifySiswaForStudents({ siswaIds: [participant.studentId], template: "remedial-result-published", subject: `Hasil remedial: ${participant.remedial.title}`, body: `Hasil remedial ${participant.remedial.title} sudah dipublikasikan.`, dedupeKey: `${participant.remedialId}:result:${remedialGrade?.id || effectiveNormalized}`, metadata: { remedialId: participant.remedialId, effectiveScore: effectiveNormalized } });
    await notifyWaliForStudents({ siswaIds: [participant.studentId], template: "remedial-result-published", subject: `Hasil remedial anak: ${participant.remedial.title}`, body: `Hasil remedial ${participant.remedial.title} sudah dipublikasikan oleh Guru.`, dedupeKey: `${participant.remedialId}:result:${effectiveNormalized}`, metadata: { remedialId: participant.remedialId, effectiveScore: effectiveNormalized } });
  }
  return { ...updated, originalScore: updated.originalScore === null ? null : Number(updated.originalScore), remedialScore: updated.remedialScore === null ? null : Number(updated.remedialScore), effectiveScore: updated.effectiveScore === null ? null : Number(updated.effectiveScore) };
}

export async function syncRemedialResultsForAssignment(assignmentId: string, studentId?: string, actorId?: string) {
  if (!isFeatureEnabled("remedialEnabled")) return { count: 0 };
  const participants = await prisma.remedialParticipant.findMany({ where: { studentId: studentId || undefined, remedial: { sourceType: "ASSIGNMENT", sourceId: assignmentId, status: "PUBLISHED" } }, select: { id: true } });
  for (const participant of participants) await syncRemedialParticipantResult(participant.id, actorId);
  return { count: participants.length };
}
