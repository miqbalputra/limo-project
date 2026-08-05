import "server-only";

import type { AssignmentSubmissionType, Prisma } from "@prisma/client";
import type { Actor } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/errors/application-error";
import { isFeatureEnabled, requireFeature } from "@/server/features/feature-flags";
import { canAccessStudent, canManageClass } from "@/server/policies/access-policy";
import { readPrivateFile, removePrivateFile, storeAssignmentFile, validateAssignmentFile } from "@/server/providers/storage/local-storage";
import { notifyWaliForStudents } from "@/server/services/notification-service";
import { createAssignmentSchema, saveAssignmentDraftSchema, submitAssignmentSchema, updateAssignmentSchema } from "@/server/validation/assignment";

function requireAssignmentsFeature() {
  requireFeature("assignmentsEnabled", "Tugas online belum diaktifkan");
}

function parseDateTime(value: string | undefined, field: string) {
  if (!value) return undefined;
  const normalized = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ? `${value}:00+07:00` : value;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) throw new ValidationError(`Tanggal ${field} belum valid`, { [field]: [`Tanggal ${field} belum valid`] });
  return parsed;
}

function assertDateOrder(availableFrom: Date | undefined, dueAt: Date | undefined, cutoffAt: Date | undefined) {
  if (availableFrom && dueAt && dueAt < availableFrom) throw new ValidationError("Tenggat tugas tidak boleh sebelum waktu tersedia", { dueAt: ["Tenggat tugas tidak boleh sebelum waktu tersedia"] });
  if (dueAt && cutoffAt && cutoffAt < dueAt) throw new ValidationError("Cutoff tugas tidak boleh sebelum tenggat", { cutoffAt: ["Cutoff tugas tidak boleh sebelum tenggat"] });
}

async function assertGuruClass(actor: Actor, kelasId: string) {
  requireAssignmentsFeature();
  if (actor.role !== "GURU" || !(await canManageClass(actor, kelasId))) throw new ForbiddenError("Anda tidak memiliki akses mengelola tugas kelas ini");
}

async function assertStudentClass(actor: Actor, kelasId: string) {
  requireAssignmentsFeature();
  if (actor.role !== "SISWA") throw new ForbiddenError("Akses tugas ini hanya tersedia untuk akun Siswa");
  const account = await prisma.siswaAccount.findUnique({ where: { userId: actor.id }, select: { siswaId: true, status: true, siswa: { select: { status: true, deletedAt: true } } } });
  if (!account || account.status !== "ACTIVE" || account.siswa.status !== "ACTIVE" || account.siswa.deletedAt) throw new ForbiddenError("Akun Siswa belum aktif");
  const enrollment = await prisma.kelasSiswa.findFirst({ where: { siswaId: account.siswaId, kelasId, status: "ACTIVE", kelas: { status: "ACTIVE" } }, select: { siswaId: true } });
  if (!enrollment) throw new NotFoundError("Kelas tidak ditemukan");
  return enrollment.siswaId;
}

async function loadPublishedStudentAssignment(actor: Actor, assignmentId: string) {
  requireAssignmentsFeature();
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: {
      id: true,
      kelasId: true,
      title: true,
      instructions: true,
      submissionType: true,
      maxScore: true,
      availableFrom: true,
      dueAt: true,
      cutoffAt: true,
      maxAttempts: true,
      allowLateSubmission: true,
      allowResubmission: true,
      status: true,
      publishedAt: true,
      kelas: { select: { id: true, name: true, program: { select: { name: true } }, level: { select: { name: true } } } },
    },
  });
  if (!assignment || assignment.status !== "PUBLISHED" || (assignment.availableFrom && assignment.availableFrom > new Date())) throw new NotFoundError("Tugas belum tersedia");
  const siswaId = await assertStudentClass(actor, assignment.kelasId);
  return { assignment, siswaId };
}

type SubmissionWithFiles = { id: string; files?: Array<{ id: string; originalName: string; mimeType: string; sizeBytes: bigint; createdAt: Date; mediaDuration?: number | null }>; grades?: unknown[] };
type SerializedSubmission<T extends SubmissionWithFiles> = Omit<T, "files" | "grades"> & { files: Array<{ id: string; originalName: string; mimeType: string; sizeBytes: string; createdAt: Date; mediaDuration: number | null }> };

function serializeSubmission<T extends SubmissionWithFiles>(submission: T | null): SerializedSubmission<T> | null {
  if (!submission) return null;
  const { files, ...rest } = submission;
  const serialized = { ...rest, files: files?.map((file) => ({ ...file, sizeBytes: file.sizeBytes.toString(), mediaDuration: file.mediaDuration ?? null })) ?? [] } as SerializedSubmission<T> & { grades?: unknown[] };
  delete serialized.grades;
  return serialized;
}

export async function listGuruAssignments(actor: Actor, kelasId: string) {
  await assertGuruClass(actor, kelasId);
  const items = await prisma.assignment.findMany({
    where: { kelasId },
    orderBy: [{ status: "asc" }, { dueAt: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      kelasId: true,
      title: true,
      instructions: true,
      submissionType: true,
      maxScore: true,
      availableFrom: true,
      dueAt: true,
      cutoffAt: true,
      maxAttempts: true,
      allowLateSubmission: true,
      allowResubmission: true,
      status: true,
      publishedAt: true,
      createdAt: true,
      updatedAt: true,
      rubricTemplateId: true,
      rubricTemplate: { select: { id: true, title: true, status: true } },
      _count: { select: { submissions: true } },
    },
  });
  return { items };
}

export async function createAssignment(actor: Actor, kelasId: string, input: unknown) {
  await assertGuruClass(actor, kelasId);
  const parsed = createAssignmentSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Data tugas belum valid", parsed.error.flatten().fieldErrors);
  const availableFrom = parseDateTime(parsed.data.availableFrom, "availableFrom");
  const dueAt = parseDateTime(parsed.data.dueAt, "dueAt");
  const cutoffAt = parseDateTime(parsed.data.cutoffAt, "cutoffAt");
  assertDateOrder(availableFrom, dueAt, cutoffAt);
  const item = await prisma.$transaction(async (tx) => {
    const assignment = await tx.assignment.create({
      data: {
        kelasId,
        title: parsed.data.title,
        instructions: parsed.data.instructions,
        submissionType: parsed.data.submissionType,
        maxScore: parsed.data.maxScore,
        availableFrom,
        dueAt,
        cutoffAt,
        maxAttempts: parsed.data.maxAttempts,
        allowLateSubmission: parsed.data.allowLateSubmission,
        allowResubmission: parsed.data.allowResubmission,
        status: "DRAFT",
        createdById: actor.id,
      },
      select: { id: true, title: true, status: true, submissionType: true },
    });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "ASSIGNMENT_CREATED", entityType: "Assignment", entityId: assignment.id } });
    return assignment;
  });
  return { item };
}

export async function getGuruAssignment(actor: Actor, assignmentId: string) {
  requireAssignmentsFeature();
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    select: {
      id: true,
      kelasId: true,
      title: true,
      instructions: true,
      submissionType: true,
      maxScore: true,
      availableFrom: true,
      dueAt: true,
      cutoffAt: true,
      maxAttempts: true,
      allowLateSubmission: true,
      allowResubmission: true,
      status: true,
      publishedAt: true,
      createdAt: true,
      updatedAt: true,
      rubricTemplateId: true,
      rubricTemplate: { select: { id: true, title: true, status: true } },
      kelas: { select: { id: true, name: true, program: { select: { name: true } }, level: { select: { name: true } } } },
    },
  });
  if (!assignment) throw new NotFoundError("Tugas tidak ditemukan");
  await assertGuruClass(actor, assignment.kelasId);
  return { item: assignment };
}

export async function updateAssignment(actor: Actor, assignmentId: string, input: unknown) {
  requireAssignmentsFeature();
  const parsed = updateAssignmentSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Data tugas belum valid", parsed.error.flatten().fieldErrors);
  const existing = await prisma.assignment.findUnique({ where: { id: assignmentId }, select: { id: true, title: true, kelasId: true, status: true, availableFrom: true, dueAt: true, cutoffAt: true, publishedAt: true } });
  if (!existing) throw new NotFoundError("Tugas tidak ditemukan");
  await assertGuruClass(actor, existing.kelasId);
  const availableFrom = Object.hasOwn(parsed.data, "availableFrom") ? parseDateTime(parsed.data.availableFrom, "availableFrom") : existing.availableFrom || undefined;
  const dueAt = Object.hasOwn(parsed.data, "dueAt") ? parseDateTime(parsed.data.dueAt, "dueAt") : existing.dueAt || undefined;
  const cutoffAt = Object.hasOwn(parsed.data, "cutoffAt") ? parseDateTime(parsed.data.cutoffAt, "cutoffAt") : existing.cutoffAt || undefined;
  assertDateOrder(availableFrom, dueAt, cutoffAt);
  const status = parsed.data.status || existing.status;
  const data: Prisma.AssignmentUpdateInput = {
    ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
    ...(parsed.data.instructions !== undefined ? { instructions: parsed.data.instructions } : {}),
    ...(parsed.data.submissionType !== undefined ? { submissionType: parsed.data.submissionType } : {}),
    ...(parsed.data.maxScore !== undefined ? { maxScore: parsed.data.maxScore } : {}),
    ...(Object.hasOwn(parsed.data, "availableFrom") ? { availableFrom: availableFrom || null } : {}),
    ...(Object.hasOwn(parsed.data, "dueAt") ? { dueAt: dueAt || null } : {}),
    ...(Object.hasOwn(parsed.data, "cutoffAt") ? { cutoffAt: cutoffAt || null } : {}),
    ...(parsed.data.maxAttempts !== undefined ? { maxAttempts: parsed.data.maxAttempts } : {}),
    ...(parsed.data.allowLateSubmission !== undefined ? { allowLateSubmission: parsed.data.allowLateSubmission } : {}),
    ...(parsed.data.allowResubmission !== undefined ? { allowResubmission: parsed.data.allowResubmission } : {}),
    status,
    ...(status === "PUBLISHED" && existing.status !== "PUBLISHED" ? { publishedAt: new Date() } : {}),
    ...(status === "DRAFT" ? { publishedAt: null } : {}),
  };
  const item = await prisma.$transaction(async (tx) => {
    const updated = await tx.assignment.update({ where: { id: assignmentId }, data, select: { id: true, title: true, status: true, publishedAt: true } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: `ASSIGNMENT_${status}`, entityType: "Assignment", entityId: assignmentId } });
    return updated;
  });
  if (status === "PUBLISHED" && existing.status !== "PUBLISHED") {
    const students = await prisma.kelasSiswa.findMany({ where: { kelasId: existing.kelasId, status: "ACTIVE" }, select: { siswaId: true } });
    await notifyWaliForStudents({ siswaIds: students.map((student) => student.siswaId), template: "assignment-published", subject: `Tugas baru: ${item.title}`, body: `Tugas ${item.title} sudah tersedia. Buka portal untuk melihat instruksi dan mengirim jawaban.`, metadata: { assignmentId } });
  }
  return { item };
}

export async function listAssignmentSubmissions(actor: Actor, assignmentId: string) {
  requireAssignmentsFeature();
  const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId }, select: { id: true, kelasId: true } });
  if (!assignment) throw new NotFoundError("Tugas tidak ditemukan");
  await assertGuruClass(actor, assignment.kelasId);
  const items = await prisma.assignmentSubmission.findMany({
    where: { assignmentId },
    orderBy: [{ student: { name: "asc" } }, { attemptNumber: "desc" }],
    select: {
      id: true,
      studentId: true,
      attemptNumber: true,
      status: true,
      onlineText: true,
      externalLink: true,
      submittedAt: true,
      isLate: true,
      version: true,
      draftSavedAt: true,
      createdAt: true,
      updatedAt: true,
      student: { select: { id: true, name: true, nomorInduk: true } },
      files: { select: { id: true, originalName: true, mimeType: true, sizeBytes: true, mediaDuration: true, createdAt: true } },
      grades: { where: { status: "PUBLISHED" }, orderBy: { createdAt: "desc" }, take: 1, select: { id: true, rawScore: true, score: true, feedbackText: true, status: true, publishedAt: true, criteria: { select: { id: true, criterionId: true, rubricLevelId: true, score: true, comment: true } } } },
    },
  });
  return { items: items.map((item) => ({ ...serializeSubmission(item)!, publishedGrade: item.grades[0] || null })) };
}

export async function listStudentAssignments(actor: Actor, kelasId: string) {
  const siswaId = await assertStudentClass(actor, kelasId);
  const now = new Date();
  const items = await prisma.assignment.findMany({
    where: { kelasId, status: "PUBLISHED", OR: [{ availableFrom: null }, { availableFrom: { lte: now } }] },
    orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      kelasId: true,
      title: true,
      instructions: true,
      submissionType: true,
      maxScore: true,
      availableFrom: true,
      dueAt: true,
      cutoffAt: true,
      maxAttempts: true,
      allowLateSubmission: true,
      allowResubmission: true,
      status: true,
      publishedAt: true,
      kelas: { select: { id: true, name: true } },
      submissions: { where: { studentId: siswaId }, orderBy: { attemptNumber: "desc" }, take: 1, select: { id: true, attemptNumber: true, status: true, submittedAt: true, isLate: true, version: true } },
    },
  });
  return { items: items.map((item) => ({ ...item, latestSubmission: item.submissions[0] || null, submissions: undefined })) };
}

export async function getStudentAssignment(actor: Actor, assignmentId: string) {
  const { assignment, siswaId } = await loadPublishedStudentAssignment(actor, assignmentId);
  const submission = await prisma.assignmentSubmission.findFirst({ where: { assignmentId, studentId: siswaId }, orderBy: { attemptNumber: "desc" }, select: { id: true, attemptNumber: true, status: true, onlineText: true, externalLink: true, submittedAt: true, isLate: true, version: true, draftSavedAt: true, files: { select: { id: true, originalName: true, mimeType: true, sizeBytes: true, mediaDuration: true, createdAt: true } }, grades: { where: { status: "PUBLISHED" }, orderBy: { createdAt: "desc" }, take: 1, select: { id: true, rawScore: true, score: true, feedbackText: true, status: true, publishedAt: true, criteria: { select: { id: true, criterionId: true, rubricLevelId: true, score: true, comment: true } } } } } });
  return { assignment, submission: submission ? { ...serializeSubmission(submission)!, publishedGrade: submission.grades[0] || null } : null };
}

export async function listWaliAssignments(actor: Actor, siswaId: string, kelasId: string) {
  requireAssignmentsFeature();
  if (actor.role !== "WALI" || !(await canAccessStudent(actor, siswaId))) throw new ForbiddenError("Anda tidak memiliki akses ke tugas siswa ini");
  const enrollment = await prisma.kelasSiswa.findFirst({ where: { siswaId, kelasId, status: "ACTIVE", kelas: { status: "ACTIVE" } }, select: { id: true } });
  if (!enrollment) throw new NotFoundError("Kelas tidak ditemukan");
  const now = new Date();
  const items = await prisma.assignment.findMany({
    where: { kelasId, status: "PUBLISHED", OR: [{ availableFrom: null }, { availableFrom: { lte: now } }] },
    orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      kelasId: true,
      title: true,
      instructions: true,
      submissionType: true,
      maxScore: true,
      availableFrom: true,
      dueAt: true,
      cutoffAt: true,
      maxAttempts: true,
      allowLateSubmission: true,
      allowResubmission: true,
      status: true,
      publishedAt: true,
      submissions: { where: { studentId: siswaId }, orderBy: { attemptNumber: "desc" }, take: 1, select: { id: true, attemptNumber: true, status: true, submittedAt: true, isLate: true, onlineText: true, externalLink: true, files: { select: { id: true, originalName: true, mimeType: true, sizeBytes: true, mediaDuration: true, createdAt: true } }, grades: { where: { status: "PUBLISHED" }, orderBy: { createdAt: "desc" }, take: 1, select: { id: true, rawScore: true, score: true, feedbackText: true, status: true, publishedAt: true, criteria: { select: { id: true, criterionId: true, rubricLevelId: true, score: true, comment: true } } } } } },
    },
  });
  return { items: items.map((item) => ({ ...item, latestSubmission: item.submissions[0] ? { ...serializeSubmission(item.submissions[0])!, publishedGrade: item.submissions[0].grades[0] || null } : null, submissions: undefined })) };
}

export async function listWaliStudentAssignments(actor: Actor, siswaId: string) {
  requireAssignmentsFeature();
  if (actor.role !== "WALI" || !(await canAccessStudent(actor, siswaId))) throw new ForbiddenError("Anda tidak memiliki akses ke tugas siswa ini");
  const enrollments = await prisma.kelasSiswa.findMany({ where: { siswaId, status: "ACTIVE", kelas: { status: "ACTIVE" } }, orderBy: { startDate: "desc" }, select: { kelasId: true, kelas: { select: { id: true, name: true, program: { select: { name: true } }, level: { select: { name: true } } } } } });
  const classes = await Promise.all(enrollments.map(async (enrollment) => ({ ...enrollment.kelas, assignments: await listWaliAssignments(actor, siswaId, enrollment.kelasId) })));
  return { classes };
}

type AssignmentForSubmission = { id: string; submissionType: AssignmentSubmissionType; maxAttempts: number; allowResubmission: boolean; allowLateSubmission: boolean; dueAt: Date | null; cutoffAt: Date | null };

function assertSubmissionContent(assignment: AssignmentForSubmission, input: { onlineText?: string; externalLink?: string }, file: File | null, isFinal: boolean) {
  if (["FILE", "IMAGE", "AUDIO", "VIDEO"].includes(assignment.submissionType)) {
    if (isFinal && !(file instanceof File)) throw new ValidationError("File jawaban wajib diunggah");
    if (file && file.size < 1) throw new ValidationError("File jawaban kosong");
    return;
  }
  if (file) throw new ValidationError("Tugas ini tidak menerima file");
  if (isFinal && assignment.submissionType === "ONLINE_TEXT" && !(input.onlineText || "").trim()) throw new ValidationError("Jawaban teks wajib diisi");
  if (isFinal && assignment.submissionType === "EXTERNAL_LINK" && !(input.externalLink || "").trim()) throw new ValidationError("Link jawaban wajib diisi");
}

async function getLatestSubmission(tx: Prisma.TransactionClient, assignmentId: string, studentId: string) {
  return tx.assignmentSubmission.findFirst({ where: { assignmentId, studentId }, orderBy: { attemptNumber: "desc" }, select: { id: true, attemptNumber: true, status: true, version: true } });
}

async function ensureDraft(tx: Prisma.TransactionClient, assignment: AssignmentForSubmission, studentId: string, actorId: string) {
  const draft = await tx.assignmentSubmission.findFirst({ where: { assignmentId: assignment.id, studentId, status: "DRAFT" }, orderBy: { attemptNumber: "desc" }, select: { id: true, attemptNumber: true, status: true, version: true } });
  if (draft) return draft;
  const latest = await getLatestSubmission(tx, assignment.id, studentId);
  if (latest && (!assignment.allowResubmission || latest.attemptNumber >= assignment.maxAttempts)) throw new ConflictError("Submission sudah dikumpulkan dan tidak dapat diulang");
  return tx.assignmentSubmission.create({ data: { assignmentId: assignment.id, studentId, attemptNumber: (latest?.attemptNumber || 0) + 1, actorUserId: actorId }, select: { id: true, attemptNumber: true, status: true, version: true } });
}

export async function saveAssignmentDraft(actor: Actor, assignmentId: string, input: unknown) {
  const { assignment, siswaId } = await loadPublishedStudentAssignment(actor, assignmentId);
  const parsed = saveAssignmentDraftSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Draft tugas belum valid", parsed.error.flatten().fieldErrors);
  assertSubmissionContent(assignment, parsed.data, null, false);
  const submission = await prisma.$transaction(async (tx) => {
    const draft = await ensureDraft(tx, assignment, siswaId, actor.id);
    if (parsed.data.version !== undefined && draft.version !== 0 && parsed.data.version !== draft.version) throw new ConflictError("Draft sudah berubah di tab lain. Muat ulang sebelum menyimpan lagi");
    const updated = await tx.assignmentSubmission.update({ where: { id: draft.id }, data: { onlineText: parsed.data.onlineText || null, externalLink: parsed.data.externalLink || null, actorUserId: actor.id, draftSavedAt: new Date(), version: { increment: 1 } }, select: { id: true, attemptNumber: true, status: true, onlineText: true, externalLink: true, version: true, draftSavedAt: true, submittedAt: true, isLate: true, files: { select: { id: true, originalName: true, mimeType: true, sizeBytes: true, createdAt: true } } } });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "ASSIGNMENT_DRAFT_SAVED", entityType: "AssignmentSubmission", entityId: draft.id, metadata: { assignmentId, version: updated.version } } });
    return updated;
  });
  return { item: serializeSubmission(submission)! };
}

export async function submitAssignment(actor: Actor, assignmentId: string, input: { data: unknown; file?: File | null }) {
  const { assignment, siswaId } = await loadPublishedStudentAssignment(actor, assignmentId);
  const parsed = submitAssignmentSchema.safeParse(input.data);
  if (!parsed.success) throw new ValidationError("Submission tugas belum valid", parsed.error.flatten().fieldErrors);
  const file = input.file instanceof File && input.file.size > 0 ? input.file : null;
  assertSubmissionContent(assignment, parsed.data, file, true);
  if (parsed.data.mediaDuration !== undefined && !["AUDIO", "VIDEO"].includes(assignment.submissionType)) throw new ValidationError("Durasi media hanya boleh dikirim untuk tugas audio atau video");
  if (file) validateAssignmentFile({ name: file.name, type: file.type, size: file.size, submissionType: assignment.submissionType });
  const now = new Date();
  if (assignment.cutoffAt && now > assignment.cutoffAt) throw new ConflictError("Batas cutoff tugas sudah lewat");
  const isLate = Boolean(assignment.dueAt && now > assignment.dueAt);
  if (isLate && !assignment.allowLateSubmission) throw new ConflictError("Tenggat tugas sudah lewat dan submission terlambat tidak diizinkan");

  const existingLatest = await prisma.assignmentSubmission.findFirst({ where: { assignmentId, studentId: siswaId }, orderBy: { attemptNumber: "desc" }, select: { id: true, attemptNumber: true, status: true, version: true, onlineText: true, externalLink: true, submittedAt: true, isLate: true, files: { select: { id: true, originalName: true, mimeType: true, sizeBytes: true, mediaDuration: true, createdAt: true } } } });
  if (existingLatest && existingLatest.status !== "DRAFT" && !assignment.allowResubmission) return { item: serializeSubmission(existingLatest)!, idempotent: true };
  const draft = await prisma.$transaction((tx) => ensureDraft(tx, assignment, siswaId, actor.id));
  if (parsed.data.version !== undefined && draft.version !== 0 && parsed.data.version !== draft.version) throw new ConflictError("Draft sudah berubah di tab lain. Muat ulang sebelum mengirim");

  let storedFile: Awaited<ReturnType<typeof storeAssignmentFile>> | undefined;
  if (file) storedFile = await storeAssignmentFile(file, `assignment-submission/${draft.id}`, assignment.submissionType);
  try {
    const submission = await prisma.$transaction(async (tx) => {
      const result = await tx.assignmentSubmission.updateMany({ where: { id: draft.id, status: "DRAFT", version: draft.version }, data: { onlineText: parsed.data.onlineText || null, externalLink: parsed.data.externalLink || null, status: isLate ? "LATE" : "SUBMITTED", submittedAt: now, isLate, actorUserId: actor.id, version: { increment: 1 } } });
      if (result.count !== 1) throw new ConflictError("Draft sudah berubah di tab lain. Muat ulang sebelum mengirim");
      if (storedFile) await tx.assignmentSubmissionFile.create({ data: { submissionId: draft.id, storageKey: storedFile.storedName, storagePath: storedFile.storagePath, originalName: storedFile.originalName, mimeType: storedFile.mimeType, sizeBytes: storedFile.sizeBytes, checksum: storedFile.checksumSha256, mediaDuration: parsed.data.mediaDuration ?? null } });
      await tx.auditLog.create({ data: { actorId: actor.id, action: "ASSIGNMENT_SUBMITTED", entityType: "AssignmentSubmission", entityId: draft.id, metadata: { assignmentId, isLate } } });
      return tx.assignmentSubmission.findUniqueOrThrow({ where: { id: draft.id }, select: { id: true, attemptNumber: true, status: true, onlineText: true, externalLink: true, submittedAt: true, isLate: true, version: true, draftSavedAt: true, files: { select: { id: true, originalName: true, mimeType: true, sizeBytes: true, createdAt: true } } } });
    });
    return { item: serializeSubmission(submission)!, idempotent: false };
  } catch (error) {
    if (storedFile) await removePrivateFile(storedFile.storagePath);
    throw error;
  }
}

export async function getAuthorizedAssignmentFile(actor: Actor, fileId: string) {
  requireAssignmentsFeature();
  const file = await prisma.assignmentSubmissionFile.findUnique({ where: { id: fileId }, select: { id: true, originalName: true, mimeType: true, sizeBytes: true, storagePath: true, submission: { select: { studentId: true, assignment: { select: { status: true, kelasId: true } } } } } });
  if (!file) throw new NotFoundError("File submission tidak ditemukan");
  let allowed = actor.role === "ADMIN";
  if (actor.role === "GURU") allowed = await canManageClass(actor, file.submission.assignment.kelasId);
  if (actor.role === "SISWA" || actor.role === "WALI") allowed = await canAccessStudent(actor, file.submission.studentId);
  if ((actor.role === "SISWA" || actor.role === "WALI") && file.submission.assignment.status !== "PUBLISHED") allowed = false;
  if (!allowed) throw new ForbiddenError("Anda tidak memiliki akses ke file submission ini");
  return { ...file, bytes: await readPrivateFile(file.storagePath) };
}

export function assignmentsFeatureEnabled() {
  return isFeatureEnabled("assignmentsEnabled");
}
