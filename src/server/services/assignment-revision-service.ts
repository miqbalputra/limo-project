import "server-only";

import type { Actor } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/errors/application-error";
import { requireFeature } from "@/server/features/feature-flags";
import { canManageClass } from "@/server/policies/access-policy";
import { notifySiswaForStudents, notifyWaliForStudents } from "@/server/services/notification-service";
import { requestAssignmentRevisionSchema } from "@/server/validation/remedial";

function requireRevisionFeature() {
  requireFeature("remedialEnabled", "Revisi tugas belum diaktifkan");
  requireFeature("assignmentsEnabled", "Tugas online belum diaktifkan");
}

function parseDateTime(value: string | undefined) {
  if (!value) return undefined;
  const normalized = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? `${value}:00+07:00` : value;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) throw new ValidationError("Tanggal deadline revisi belum valid");
  return parsed;
}

export async function requestAssignmentRevision(actor: Actor, submissionId: string, input: unknown) {
  requireRevisionFeature();
  const parsed = requestAssignmentRevisionSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Data permintaan revisi belum valid", parsed.error.flatten().fieldErrors);
  const submission = await prisma.assignmentSubmission.findUnique({ where: { id: submissionId }, select: { id: true, status: true, studentId: true, assignmentId: true, remedialParticipantId: true, revisionRequestId: true, openRevisionKey: true, assignment: { select: { id: true, title: true, kelasId: true } }, revisionSourceRequests: { where: { status: "OPEN" }, select: { id: true } } } });
  if (!submission) throw new NotFoundError("Submission tidak ditemukan");
  if (actor.role !== "GURU" || !(await canManageClass(actor, submission.assignment.kelasId))) throw new ForbiddenError("Anda tidak memiliki akses meminta revisi submission ini");
  if (submission.remedialParticipantId || submission.revisionRequestId) throw new ConflictError("Revisi hanya dapat diminta dari submission tugas original");
  if (!["GRADED", "SUBMITTED", "LATE"].includes(submission.status)) throw new ConflictError("Submission belum siap diminta revisi");
  if (submission.revisionSourceRequests.length > 0) throw new ConflictError("Submission ini sudah memiliki permintaan revisi terbuka");
  const dueAt = parseDateTime(parsed.data.dueAt);
  if (dueAt && dueAt <= new Date()) throw new ValidationError("Deadline revisi harus berada di masa depan");
  const revision = await prisma.$transaction(async (tx) => {
    const locked = await tx.assignmentSubmission.updateMany({ where: { id: submissionId, status: { in: ["GRADED", "SUBMITTED", "LATE"] }, openRevisionKey: null }, data: { status: "NEEDS_REVISION", openRevisionKey: submissionId } });
    if (locked.count !== 1) throw new ConflictError("Submission ini sudah memiliki permintaan revisi terbuka");
    const created = await tx.assignmentRevisionRequest.create({ data: { assignmentId: submission.assignmentId, studentId: submission.studentId, sourceSubmissionId: submissionId, requestedById: actor.id, reason: parsed.data.reason, instructions: parsed.data.instructions || null, dueAt: dueAt || null, status: "OPEN" }, select: { id: true, assignmentId: true, studentId: true, sourceSubmissionId: true, reason: true, instructions: true, dueAt: true, status: true, requestedAt: true } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "ASSIGNMENT_REVISION_REQUESTED", entityType: "AssignmentRevisionRequest", entityId: created.id, reason: parsed.data.reason, metadata: { assignmentId: submission.assignmentId, submissionId } } });
    return created;
  });
  await notifySiswaForStudents({ siswaIds: [submission.studentId], template: "assignment-revision-requested", subject: `Revisi diperlukan: ${submission.assignment.title}`, body: `Guru meminta revisi untuk tugas ${submission.assignment.title}. ${parsed.data.instructions || parsed.data.reason}`, dedupeKey: revision.id, metadata: { assignmentId: submission.assignmentId, revisionId: revision.id, dueAt: revision.dueAt?.toISOString() || null } });
  await notifyWaliForStudents({ siswaIds: [submission.studentId], template: "assignment-revision-requested", subject: `Revisi tugas anak: ${submission.assignment.title}`, body: `Guru meminta anak mengerjakan revisi tugas ${submission.assignment.title}.`, dedupeKey: revision.id, metadata: { assignmentId: submission.assignmentId, revisionId: revision.id } });
  return { item: revision };
}

export async function getOpenRevisionForStudent(studentId: string, assignmentId: string) {
  requireRevisionFeature();
  return prisma.assignmentRevisionRequest.findFirst({ where: { studentId, assignmentId, status: "OPEN" }, orderBy: { requestedAt: "desc" }, select: { id: true, assignmentId: true, studentId: true, sourceSubmissionId: true, responseSubmission: { select: { id: true, attemptNumber: true, status: true, onlineText: true, externalLink: true, submittedAt: true, isLate: true, version: true, draftSavedAt: true, files: { select: { id: true, originalName: true, mimeType: true, sizeBytes: true, mediaDuration: true, createdAt: true } }, grades: { where: { status: "PUBLISHED" }, orderBy: { createdAt: "desc" }, take: 1, select: { id: true, rawScore: true, score: true, feedbackText: true, status: true, publishedAt: true, criteria: { select: { id: true, criterionId: true, rubricLevelId: true, score: true, comment: true } } } } } }, reason: true, instructions: true, dueAt: true, status: true, requestedAt: true } });
}

export async function markRevisionSubmitted(revisionId: string) {
  await prisma.assignmentRevisionRequest.updateMany({ where: { id: revisionId, status: "OPEN" }, data: { status: "SUBMITTED", submittedAt: new Date() } });
}

export async function markRevisionCompleted(revisionId: string, actorId?: string) {
  const revision = await prisma.assignmentRevisionRequest.findUnique({ where: { id: revisionId }, select: { id: true, sourceSubmissionId: true, status: true } });
  if (!revision || !["OPEN", "SUBMITTED"].includes(revision.status)) return;
  await prisma.$transaction([
    prisma.assignmentRevisionRequest.update({ where: { id: revisionId }, data: { status: "COMPLETED", completedAt: new Date() } }),
    prisma.assignmentSubmission.update({ where: { id: revision.sourceSubmissionId }, data: { status: "GRADED", openRevisionKey: null } }),
    prisma.auditLog.create({ data: { actorId, action: "ASSIGNMENT_REVISION_COMPLETED", entityType: "AssignmentRevisionRequest", entityId: revisionId } }),
  ]);
}
