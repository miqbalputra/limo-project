import "server-only";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import type { Actor } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/errors/application-error";
import { requireFeature } from "@/server/features/feature-flags";
import { assertRateLimit } from "@/server/security/rate-limit";
import { storeQuizSubmissionFile } from "@/server/providers/storage/local-storage";
import { canManageClass } from "@/server/policies/access-policy";
import { getQuizMedia } from "@/server/services/quiz-media-service";
import { syncActivityCompletionForExam } from "@/server/services/activity-completion-service";
import {
  answerValidationProblem,
  findMissingRequiredAnswers,
  gradeObjectiveAnswer,
  isWithinSubmitGrace,
  parseBranchRules,
  readFileUploadConfig,
  type AnswerValidation,
  type GradableQuestion,
} from "@/server/services/quiz-grading";

const WALI_ONLINE_MODES = ["ONLINE_VIA_WALI", "BOTH"];
const SISWA_ONLINE_MODES = ["ONLINE_VIA_SISWA", "BOTH"];

type AttemptScope =
  | { kind: "WALI"; waliProfileId: string }
  | { kind: "SISWA"; siswaAccountId: string };

function attemptScopeWhere(scope: AttemptScope) {
  return scope.kind === "WALI"
    ? { waliProfileId: scope.waliProfileId }
    : { siswaAccountId: scope.siswaAccountId };
}

const attemptAnswerSchema = z.object({
  ujianSoalId: z.string().min(8).max(64),
  selectedOption: z.string().trim().max(8).optional().or(z.literal("")),
  selectedOptions: z.array(z.string().trim().max(8)).max(16).optional(),
  shortAnswer: z.string().trim().max(10000).optional().or(z.literal("")),
  essayAnswer: z.string().trim().max(10000).optional().or(z.literal("")),
  structuredAnswer: z.record(z.string(), z.unknown()).optional(),
});

const submitAttemptSchema = z.object({ answers: z.array(attemptAnswerSchema).min(1).max(100) });
const saveAttemptDraftSchema = z.object({ answers: z.array(attemptAnswerSchema).max(100) });
const violationSchema = z.object({ reason: z.string().trim().max(160).optional().or(z.literal("")) });

function sortedLabels(values: string[] | undefined) {
  return [...new Set((values || []).map((value) => value.trim().toUpperCase()).filter(Boolean))].sort();
}

function toInputJson(value: unknown) {
  return value === undefined ? undefined : value as Prisma.InputJsonValue;
}

async function readQuestionUploadConfig(ujianSoalId: string | null | undefined, ujianId: string) {
  if (!ujianSoalId) return {};

  const question = await prisma.ujianSoal.findUnique({
    where: { id: ujianSoalId },
    select: { ujianId: true, bankSoal: { select: { fileUploadConfig: true } } },
  });

  if (!question || question.ujianId !== ujianId) {
    throw new ValidationError("Soal unggahan tidak ditemukan pada ujian ini");
  }

  return readFileUploadConfig(question.bankSoal.fileUploadConfig);
}

async function getWaliProfile(actor: Actor) {
  if (actor.role !== "WALI") {
    throw new ForbiddenError();
  }

  const profile = await prisma.waliProfile.findUnique({ where: { userId: actor.id }, select: { id: true } });

  if (!profile) {
    throw new ForbiddenError("Profil wali belum tersedia");
  }

  return profile;
}

async function assertWaliCanAccessStudent(actor: Actor, siswaId: string) {
  const profile = await getWaliProfile(actor);
  const relation = await prisma.waliSiswa.findFirst({
    where: { siswaId, endedAt: null, waliProfileId: profile.id },
    select: { id: true },
  });

  if (!relation) {
    throw new ForbiddenError("Anda tidak memiliki akses ke anak ini");
  }

  return profile;
}

async function getStudentAccount(actor: Actor) {
  requireFeature("studentSelfExamEnabled", "Ujian mandiri siswa belum diaktifkan");

  if (actor.role !== "SISWA") {
    throw new ForbiddenError();
  }

  const account = await prisma.siswaAccount.findUnique({
    where: { userId: actor.id },
    select: { id: true, siswaId: true, status: true, siswa: { select: { status: true, deletedAt: true } } },
  });

  if (!account || account.status !== "ACTIVE" || account.siswa.status !== "ACTIVE" || account.siswa.deletedAt) {
    throw new ForbiddenError("Akun siswa belum aktif");
  }

  return { id: account.id, siswaId: account.siswaId };
}

function onlineExamWhere(siswaId: string, modes: string[]) {
  const now = new Date();

  return {
    status: "PUBLISHED" as const,
    deliveryMode: { in: modes },
    AND: [
      { OR: [{ availableFrom: null }, { availableFrom: { lte: now } }] },
      { OR: [{ availableUntil: null }, { availableUntil: { gte: now } }] },
    ],
    kelas: { enrollments: { some: { siswaId, status: "ACTIVE" as const } } },
  };
}

export async function listWaliTaskChildren(actor: Actor, selectedStudentId: string | null = null) {
  const profile = await getWaliProfile(actor);
  const relations = await prisma.waliSiswa.findMany({
    where: { waliProfileId: profile.id, endedAt: null, ...(selectedStudentId ? { siswaId: selectedStudentId } : {}) },
    orderBy: { siswa: { name: "asc" } },
    select: {
      siswa: { select: { id: true, name: true, nomorInduk: true, program: { select: { name: true } } } },
    },
  });

  const children = await Promise.all(relations.map(async (relation) => {
    const tasks = await getStudentTaskRows(profile.id, relation.siswa.id);

    return {
      ...relation.siswa,
      taskCount: tasks.length,
      notStartedCount: tasks.filter((task) => task.status === "NOT_STARTED").length,
      inProgressCount: tasks.filter((task) => task.status === "IN_PROGRESS").length,
      reviewCount: tasks.filter((task) => task.status === "NEEDS_REVIEW").length,
      finalCount: tasks.filter((task) => task.status === "FINAL").length,
    };
  }));

  return { children };
}

export async function listWaliStudentTasks(actor: Actor, siswaId: string) {
  const profile = await assertWaliCanAccessStudent(actor, siswaId);
  const siswa = await prisma.siswa.findUnique({
    where: { id: siswaId },
    select: { id: true, name: true, nomorInduk: true, program: { select: { name: true } } },
  });

  if (!siswa) {
    throw new NotFoundError("Siswa tidak ditemukan");
  }

  return { siswa, tasks: await getStudentTaskRows(profile.id, siswaId) };
}

async function getTaskRows(params: {
  siswaId: string;
  modes: string[];
  attemptsWhere: Prisma.UjianAttemptWhereInput;
  resultWhere: Prisma.HasilUjianWhereInput;
}) {
  const exams = await prisma.ujian.findMany({
    where: onlineExamWhere(params.siswaId, params.modes),
    orderBy: [{ examDate: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      description: true,
      examDate: true,
      durationMinutes: true,
      availableUntil: true,
      maxAttempts: true,
      kelas: { select: { name: true, program: { select: { name: true } } } },
      _count: { select: { questions: true } },
      attempts: {
        where: { siswaId: params.siswaId, ...params.attemptsWhere },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, status: true, submittedAt: true, hasilUjianId: true, expiresAt: true },
      },
      results: {
        where: { siswaId: params.siswaId, ...params.resultWhere },
        take: 1,
        select: { id: true, status: true, totalScore: true, finalizedAt: true },
      },
    },
  });

  return exams.map((exam) => {
    const attempt = exam.attempts[0];
    const result = exam.results[0];
    const status = result?.status === "FINAL" || result?.status === "CORRECTED"
      ? "FINAL"
      : result?.status === "NEEDS_REVIEW" || attempt?.status === "NEEDS_REVIEW"
        ? "NEEDS_REVIEW"
        : attempt?.status === "IN_PROGRESS" && (!attempt.expiresAt || attempt.expiresAt > new Date())
          ? "IN_PROGRESS"
          : attempt?.status === "FINAL" || attempt?.status === "CORRECTED"
            ? "SUBMITTED"
            : "NOT_STARTED";

    return { ...exam, latestAttempt: attempt ?? null, result: result ?? null, status };
  });
}

async function getStudentTaskRows(waliProfileId: string, siswaId: string) {
  return getTaskRows({
    siswaId,
    modes: WALI_ONLINE_MODES,
    attemptsWhere: { waliProfileId },
    resultWhere: { OR: [{ ujian: { showResultToWali: true } }, { releasedAt: { not: null } }] },
  });
}

async function getStudentOwnExamRows(siswaId: string, siswaAccountId: string) {
  return getTaskRows({
    siswaId,
    modes: SISWA_ONLINE_MODES,
    attemptsWhere: { siswaAccountId },
    resultWhere: { OR: [{ ujian: { showResultToSiswa: true } }, { releasedAt: { not: null } }] },
  });
}

export async function getWaliExamInstruction(actor: Actor, siswaId: string, ujianId: string) {
  await assertWaliCanAccessStudent(actor, siswaId);
  const ujian = await prisma.ujian.findFirst({
    where: { id: ujianId, ...onlineExamWhere(siswaId, WALI_ONLINE_MODES) },
    select: {
      id: true,
      title: true,
      description: true,
      durationMinutes: true,
      availableUntil: true,
      maxAttempts: true,
      kelas: { select: { name: true, program: { select: { name: true } } } },
      _count: { select: { questions: true } },
    },
  });

  if (!ujian) {
    throw new NotFoundError("Ujian online tidak tersedia untuk anak ini");
  }

  const siswa = await prisma.siswa.findUnique({ where: { id: siswaId }, select: { id: true, name: true, nomorInduk: true } });

  if (!siswa) {
    throw new NotFoundError("Siswa tidak ditemukan");
  }

  return { siswa, ujian };
}

export async function listStudentExams(actor: Actor) {
  const account = await getStudentAccount(actor);
  const siswa = await prisma.siswa.findUnique({
    where: { id: account.siswaId },
    select: { id: true, name: true, nomorInduk: true, program: { select: { name: true } } },
  });

  if (!siswa) {
    throw new NotFoundError("Siswa tidak ditemukan");
  }

  return { siswa, exams: await getStudentOwnExamRows(account.siswaId, account.id) };
}

export async function getStudentExamInstruction(actor: Actor, ujianId: string) {
  const account = await getStudentAccount(actor);
  const ujian = await prisma.ujian.findFirst({
    where: { id: ujianId, ...onlineExamWhere(account.siswaId, SISWA_ONLINE_MODES) },
    select: {
      id: true,
      title: true,
      description: true,
      durationMinutes: true,
      availableUntil: true,
      maxAttempts: true,
      kelas: { select: { name: true, program: { select: { name: true } } } },
      _count: { select: { questions: true } },
    },
  });

  if (!ujian) {
    throw new NotFoundError("Ujian online tidak tersedia untuk Anda");
  }

  const siswa = await prisma.siswa.findUnique({ where: { id: account.siswaId }, select: { id: true, name: true, nomorInduk: true } });

  if (!siswa) {
    throw new NotFoundError("Siswa tidak ditemukan");
  }

  return { siswa, ujian };
}

async function startAttempt(params: {
  actor: Actor;
  siswaId: string;
  ujianId: string;
  scope: AttemptScope;
  startedByRole: "WALI" | "SISWA";
  modes: string[];
  notAvailableMessage: string;
}) {
  const { actor, siswaId, ujianId, scope, startedByRole, modes, notAvailableMessage } = params;
  const ujian = await prisma.ujian.findFirst({
    where: { id: ujianId, ...onlineExamWhere(siswaId, modes) },
    select: { id: true, durationMinutes: true, maxAttempts: true },
  });

  if (!ujian) {
    throw new NotFoundError(notAvailableMessage);
  }

  const activeAttempt = await prisma.ujianAttempt.findFirst({
    where: { ujianId, siswaId, status: "IN_PROGRESS" },
    orderBy: { createdAt: "desc" },
    select: { id: true, expiresAt: true, startedByRole: true, waliProfileId: true, siswaAccountId: true },
  });

  if (activeAttempt) {
    if (!activeAttempt.expiresAt || activeAttempt.expiresAt > new Date()) {
      const ownedBySameScope = scope.kind === "WALI"
        ? activeAttempt.waliProfileId === scope.waliProfileId
        : activeAttempt.siswaAccountId === scope.siswaAccountId;

      if (!ownedBySameScope) {
        throw new ConflictError(
          activeAttempt.startedByRole === "SISWA"
            ? "Ujian sedang dikerjakan oleh siswa yang bersangkutan"
            : "Ujian sedang dikerjakan melalui akun Wali",
        );
      }

      return { attemptId: activeAttempt.id };
    }

    await prisma.ujianAttempt.update({ where: { id: activeAttempt.id }, data: { status: "EXPIRED" } });
  }

  const attempt = await prisma.$transaction(async (tx) => {
    const attemptCount = await tx.ujianAttempt.count({
      where: { ujianId, siswaId, status: { not: "CANCELLED" } },
    });

    if (attemptCount >= ujian.maxAttempts) {
      throw new ConflictError("Batas pengerjaan ujian sudah tercapai");
    }

    return tx.ujianAttempt.create({
      data: {
        ujianId,
        siswaId,
        startedByRole,
        ...(scope.kind === "WALI" ? { waliProfileId: scope.waliProfileId } : { siswaAccountId: scope.siswaAccountId }),
        status: "IN_PROGRESS",
        expiresAt: new Date(Date.now() + ujian.durationMinutes * 60 * 1000),
      },
      select: { id: true },
    });
  });

  await prisma.auditLog.create({ data: { actorId: actor.id, action: "UJIAN_ATTEMPT_STARTED", entityType: "UjianAttempt", entityId: attempt.id } });

  return { attemptId: attempt.id };
}

export async function startWaliExamAttempt(actor: Actor, siswaId: string, ujianId: string) {
  const profile = await assertWaliCanAccessStudent(actor, siswaId);

  return startAttempt({
    actor,
    siswaId,
    ujianId,
    scope: { kind: "WALI", waliProfileId: profile.id },
    startedByRole: "WALI",
    modes: WALI_ONLINE_MODES,
    notAvailableMessage: "Ujian online tidak tersedia untuk anak ini",
  });
}

export async function startStudentExamAttempt(actor: Actor, ujianId: string) {
  const account = await getStudentAccount(actor);

  return startAttempt({
    actor,
    siswaId: account.siswaId,
    ujianId,
    scope: { kind: "SISWA", siswaAccountId: account.id },
    startedByRole: "SISWA",
    modes: SISWA_ONLINE_MODES,
    notAvailableMessage: "Ujian online tidak tersedia untuk Anda",
  });
}

async function loadAttemptContext(scope: AttemptScope, attemptId: string) {
  const attempt = await prisma.ujianAttempt.findFirst({
    where: { id: attemptId, ...attemptScopeWhere(scope) },
    select: {
      id: true,
      status: true,
      expiresAt: true,
      draftAnswers: true,
      draftSavedAt: true,
      violationCount: true,
      lastViolationAt: true,
      siswa: { select: { id: true, name: true, nomorInduk: true } },
      ujian: {
        select: {
          id: true,
          title: true,
          description: true,
          durationMinutes: true,
          presentationMode: true,
          themeColor: true,
          headerImageUrl: true,
          secureMode: true,
          questions: {
            orderBy: { order: "asc" },
            select: {
              id: true,
              weight: true,
              required: true,
              sectionId: true,
              branchRules: true,
              bankSoal: {
                select: {
                  type: true,
                  question: true,
                  helpText: true,
                  stimulusText: true,
                  mediaUrl: true,
                  language: true,
                  direction: true,
                  allowOther: true,
                  structuredPayload: true,
                  fileUploadConfig: true,
                  options: { orderBy: { order: "asc" }, select: { label: true, content: true, mediaUrl: true } },
                },
              },
            },
          },
          sections: { orderBy: { order: "asc" }, select: { id: true, order: true, title: true, description: true } },
        },
      },
    },
  });

  if (!attempt) {
    throw new NotFoundError("Attempt ujian tidak ditemukan");
  }

  if (attempt.status === "IN_PROGRESS" && attempt.expiresAt && attempt.expiresAt <= new Date()) {
    await prisma.ujianAttempt.update({ where: { id: attempt.id }, data: { status: "EXPIRED" } });
    return { attempt: { ...attempt, status: "EXPIRED" } };
  }

  return { attempt };
}

export async function getWaliAttemptContext(actor: Actor, attemptId: string) {
  const profile = await getWaliProfile(actor);
  return loadAttemptContext({ kind: "WALI", waliProfileId: profile.id }, attemptId);
}

export async function getStudentAttemptContext(actor: Actor, attemptId: string) {
  const account = await getStudentAccount(actor);
  return loadAttemptContext({ kind: "SISWA", siswaAccountId: account.id }, attemptId);
}

async function persistAttemptDraft(scope: AttemptScope, attemptId: string, input: unknown) {
  const parsed = saveAttemptDraftSchema.safeParse(input);

  if (!parsed.success) {
    throw new ValidationError("Draft jawaban belum valid", parsed.error.flatten().fieldErrors);
  }

  const attempt = await prisma.ujianAttempt.findFirst({
    where: { id: attemptId, ...attemptScopeWhere(scope) },
    select: { id: true, status: true, expiresAt: true, ujian: { select: { questions: { select: { id: true } } } } },
  });

  if (!attempt) {
    throw new NotFoundError("Attempt ujian tidak ditemukan");
  }

  if (attempt.status !== "IN_PROGRESS") {
    throw new ConflictError("Attempt ujian sudah tidak aktif");
  }

  if (attempt.expiresAt && attempt.expiresAt <= new Date()) {
    await prisma.ujianAttempt.update({ where: { id: attempt.id }, data: { status: "EXPIRED" } });
    throw new ConflictError("Waktu pengerjaan ujian sudah habis");
  }

  const questionIds = new Set(attempt.ujian.questions.map((question) => question.id));
  const answerIds = parsed.data.answers.map((answer) => answer.ujianSoalId);

  if (new Set(answerIds).size !== answerIds.length || answerIds.some((id) => !questionIds.has(id))) {
    throw new ValidationError("Draft berisi soal yang tidak sesuai dengan ujian");
  }

  const draftSavedAt = new Date();
  await prisma.ujianAttempt.update({
    where: { id: attempt.id },
    data: { draftAnswers: toInputJson(parsed.data.answers), draftSavedAt },
  });

  return { draftSavedAt };
}

export async function saveWaliAttemptDraft(actor: Actor, attemptId: string, input: unknown) {
  const profile = await getWaliProfile(actor);
  return persistAttemptDraft({ kind: "WALI", waliProfileId: profile.id }, attemptId, input);
}

export async function saveStudentAttemptDraft(actor: Actor, attemptId: string, input: unknown) {
  const account = await getStudentAccount(actor);
  return persistAttemptDraft({ kind: "SISWA", siswaAccountId: account.id }, attemptId, input);
}

async function persistAttemptViolation(scope: AttemptScope, attemptId: string, input: unknown) {
  const parsed = violationSchema.safeParse(input ?? {});

  if (!parsed.success) {
    throw new ValidationError("Data pelanggaran tidak valid", parsed.error.flatten().fieldErrors);
  }

  const attempt = await prisma.ujianAttempt.findFirst({
    where: { id: attemptId, ...attemptScopeWhere(scope), status: "IN_PROGRESS" },
    select: { id: true },
  });

  if (!attempt) {
    throw new NotFoundError("Attempt ujian tidak ditemukan");
  }

  assertRateLimit({ key: `exam-violation:${attempt.id}`, limit: 120, windowMs: 60 * 60 * 1000, message: "Terlalu banyak laporan pelanggaran." });

  const updated = await prisma.ujianAttempt.update({
    where: { id: attempt.id },
    data: { violationCount: { increment: 1 }, lastViolationAt: new Date() },
    select: { violationCount: true },
  });

  return { violationCount: updated.violationCount };
}

export async function recordWaliAttemptViolation(actor: Actor, attemptId: string, input: unknown) {
  const profile = await getWaliProfile(actor);
  return persistAttemptViolation({ kind: "WALI", waliProfileId: profile.id }, attemptId, input);
}

export async function recordStudentAttemptViolation(actor: Actor, attemptId: string, input: unknown) {
  const account = await getStudentAccount(actor);
  return persistAttemptViolation({ kind: "SISWA", siswaAccountId: account.id }, attemptId, input);
}

async function persistAttemptFile(scope: AttemptScope, attemptId: string, file: File | null, ujianSoalId?: string | null) {
  if (!file) {
    throw new ValidationError("File jawaban wajib dipilih");
  }

  const attempt = await prisma.ujianAttempt.findFirst({
    where: { id: attemptId, ...attemptScopeWhere(scope) },
    select: { id: true, ujianId: true, status: true, expiresAt: true },
  });

  if (!attempt) {
    throw new NotFoundError("Attempt ujian tidak ditemukan");
  }
  if (attempt.status !== "IN_PROGRESS") {
    throw new ConflictError("Attempt ujian sudah tidak aktif");
  }
  if (attempt.expiresAt && attempt.expiresAt < new Date()) {
    await prisma.ujianAttempt.update({ where: { id: attempt.id }, data: { status: "EXPIRED" } });
    throw new ConflictError("Waktu pengerjaan ujian sudah habis");
  }

  assertRateLimit({ key: `exam-upload:${attempt.id}`, limit: 60, windowMs: 60 * 60 * 1000, message: "Terlalu banyak unggahan. Coba lagi nanti." });

  const uploadConfig = await readQuestionUploadConfig(ujianSoalId, attempt.ujianId);
  const stored = await storeQuizSubmissionFile(file, "quiz-submission", uploadConfig);
  const media = await prisma.quizMedia.create({
    data: {
      originalName: stored.originalName,
      storedName: stored.storedName,
      storagePath: stored.storagePath,
      mimeType: stored.mimeType,
      sizeBytes: stored.sizeBytes,
    },
    select: { id: true, originalName: true, sizeBytes: true, mimeType: true },
  });

  return { item: { id: media.id, name: media.originalName, size: Number(media.sizeBytes), mimeType: media.mimeType } };
}

export async function uploadWaliAttemptFile(actor: Actor, attemptId: string, file: File | null, ujianSoalId?: string | null) {
  const profile = await getWaliProfile(actor);
  return persistAttemptFile({ kind: "WALI", waliProfileId: profile.id }, attemptId, file, ujianSoalId);
}

export async function uploadStudentAttemptFile(actor: Actor, attemptId: string, file: File | null, ujianSoalId?: string | null) {
  const account = await getStudentAccount(actor);
  return persistAttemptFile({ kind: "SISWA", siswaAccountId: account.id }, attemptId, file, ujianSoalId);
}

async function resolveAttemptFile(attempt: { hasilUjianId: string | null; draftAnswers: unknown }, fileId: string) {
  let haystack = JSON.stringify(attempt.draftAnswers ?? "");
  if (attempt.hasilUjianId) {
    const rows = await prisma.jawabanUjian.findMany({ where: { hasilUjianId: attempt.hasilUjianId }, select: { structuredAnswer: true } });
    haystack += JSON.stringify(rows);
  }
  if (!haystack.includes(fileId)) {
    throw new NotFoundError("File tidak ditemukan pada attempt ini");
  }

  return getQuizMedia(fileId);
}

export async function getWaliAttemptFile(actor: Actor, ujianId: string, attemptId: string, fileId: string) {
  const ujian = await prisma.ujian.findUnique({ where: { id: ujianId }, select: { kelasId: true } });
  if (!ujian) {
    throw new NotFoundError("Ujian tidak ditemukan");
  }
  if (actor.role !== "ADMIN") {
    if (actor.role !== "GURU" || !(await canManageClass(actor, ujian.kelasId))) {
      throw new ForbiddenError();
    }
  }

  const attempt = await prisma.ujianAttempt.findUnique({ where: { id: attemptId }, select: { ujianId: true, hasilUjianId: true, draftAnswers: true } });
  if (!attempt || attempt.ujianId !== ujianId) {
    throw new NotFoundError("Attempt tidak ditemukan");
  }

  return resolveAttemptFile(attempt, fileId);
}

export async function getStudentAttemptFile(actor: Actor, attemptId: string, fileId: string) {
  const account = await getStudentAccount(actor);

  const attempt = await prisma.ujianAttempt.findFirst({
    where: { id: attemptId, siswaAccountId: account.id },
    select: { hasilUjianId: true, draftAnswers: true },
  });
  if (!attempt) {
    throw new NotFoundError("Attempt ujian tidak ditemukan");
  }

  return resolveAttemptFile(attempt, fileId);
}

async function finalizeAttempt(scope: AttemptScope, actor: Actor, attemptId: string, input: unknown) {
  const parsed = submitAttemptSchema.safeParse(input);

  if (!parsed.success) {
    throw new ValidationError("Jawaban ujian belum valid", parsed.error.flatten().fieldErrors);
  }

  const attempt = await prisma.ujianAttempt.findFirst({
    where: { id: attemptId, ...attemptScopeWhere(scope) },
    include: {
      ujian: {
        include: {
          sections: { orderBy: { order: "asc" }, select: { id: true } },
          questions: {
            orderBy: { order: "asc" },
            include: { bankSoal: { include: { options: true } } },
          },
        },
      },
    },
  });

  if (!attempt) {
    throw new NotFoundError("Attempt ujian tidak ditemukan");
  }

  if (attempt.status !== "IN_PROGRESS" && attempt.status !== "EXPIRED") {
    throw new ConflictError("Attempt ujian sudah dikumpulkan");
  }

  const submittedAt = new Date();
  if (!isWithinSubmitGrace(attempt.expiresAt, submittedAt)) {
    await prisma.ujianAttempt.update({ where: { id: attempt.id }, data: { status: "EXPIRED" } });
    throw new ConflictError("Waktu pengerjaan ujian sudah habis");
  }

  const submittedWithinWindow = !attempt.expiresAt || attempt.expiresAt >= submittedAt;

  const answersByQuestion = new Map(parsed.data.answers.map((answer) => [answer.ujianSoalId, answer]));
  const questionIds = new Set(attempt.ujian.questions.map((question) => question.id));

  for (const answer of parsed.data.answers) {
    if (!questionIds.has(answer.ujianSoalId)) {
      throw new ValidationError("Ada jawaban untuk soal yang bukan bagian dari ujian ini");
    }
  }

  if (submittedWithinWindow) {
    const sectionIndexById = new Map(attempt.ujian.sections.map((section, index) => [section.id, index]));
    const questions: GradableQuestion[] = attempt.ujian.questions.map((question) => ({
      id: question.id,
      required: question.required,
      type: question.bankSoal.type,
      sectionIndex: question.sectionId ? (sectionIndexById.get(question.sectionId) ?? 0) : 0,
      branchRules: parseBranchRules(question.branchRules),
    }));
    const missing = findMissingRequiredAnswers({
      questions,
      answers: parsed.data.answers,
      sectionCount: attempt.ujian.sections.length > 0 ? attempt.ujian.sections.length : 1,
    });
    if (missing.length > 0) {
      throw new ValidationError(`Masih ada ${missing.length} soal wajib yang belum diisi`);
    }
  }

  for (const question of attempt.ujian.questions) {
    const config = (question.bankSoal.structuredPayload as { validation?: AnswerValidation } | null)?.validation;
    const problem = answerValidationProblem({ validation: config, answer: answersByQuestion.get(question.id) });
    if (problem) {
      throw new ValidationError(`Jawaban untuk "${question.bankSoal.question.slice(0, 60)}" tidak valid: ${problem}`);
    }
  }

  let earnedWeight = 0;
  let needsReview = false;
  const totalWeight = attempt.ujian.questions.reduce((sum, question) => sum + Number(question.weight), 0);

  const answerRows = attempt.ujian.questions.map((question) => {
    const answer = answersByQuestion.get(question.id);
    const correctLabels = sortedLabels(question.bankSoal.options.filter((option) => option.isCorrect).map((option) => option.label));
    const graded = gradeObjectiveAnswer({
      type: question.bankSoal.type,
      weight: Number(question.weight),
      correctLabels,
      expectedAnswer: question.bankSoal.expectedAnswer ?? null,
      acceptedAnswers: question.bankSoal.acceptedAnswers,
      structuredPayload: question.bankSoal.structuredPayload,
      answer,
    });
    const isMulti = question.bankSoal.type === "MULTI_SELECT";

    if (graded.score === null) {
      needsReview = true;
    } else {
      earnedWeight += graded.score;
    }

    return {
      ujianSoalId: question.id,
      bankSoalId: question.bankSoalId,
      selectedOption: isMulti ? undefined : (answer?.selectedOption?.toUpperCase() || undefined),
      selectedOptions: isMulti ? sortedLabels(answer?.selectedOptions) : undefined,
      shortAnswer: answer?.shortAnswer || undefined,
      essayAnswer: answer?.essayAnswer || undefined,
      structuredAnswer: toInputJson(answer?.structuredAnswer),
      score: graded.score === null ? undefined : graded.score,
      needsReview: graded.score === null,
    };
  });

  const totalScore = totalWeight > 0 ? Number(((earnedWeight / totalWeight) * 100).toFixed(2)) : 0;

  const item = await prisma.$transaction(async (tx) => {
    const existing = await tx.hasilUjian.findUnique({
      where: { ujianId_siswaId: { ujianId: attempt.ujianId, siswaId: attempt.siswaId } },
      select: { id: true, status: true },
    });

    if (existing && ["FINAL", "CORRECTED"].includes(existing.status)) {
      throw new ConflictError("Hasil ujian sudah final");
    }

    if (existing) {
      await tx.jawabanUjian.deleteMany({ where: { hasilUjianId: existing.id } });
    }

    const hasil = existing
      ? await tx.hasilUjian.update({
          where: { id: existing.id },
          data: { status: needsReview ? "NEEDS_REVIEW" : "FINAL", totalScore, finalizedAt: needsReview ? null : new Date(), updatedById: actor.id },
          select: { id: true, status: true, totalScore: true },
        })
      : await tx.hasilUjian.create({
          data: { ujianId: attempt.ujianId, siswaId: attempt.siswaId, status: needsReview ? "NEEDS_REVIEW" : "FINAL", totalScore, finalizedAt: needsReview ? null : new Date(), createdById: actor.id, updatedById: actor.id },
          select: { id: true, status: true, totalScore: true },
        });

    await tx.jawabanUjian.createMany({
      data: answerRows.map((answer) => ({
        hasilUjianId: hasil.id,
        ujianSoalId: answer.ujianSoalId,
        bankSoalId: answer.bankSoalId,
        selectedOption: answer.selectedOption,
        selectedOptions: toInputJson(answer.selectedOptions),
        shortAnswer: answer.shortAnswer,
        structuredAnswer: answer.structuredAnswer,
        essayAnswer: answer.essayAnswer,
        score: answer.score,
        needsReview: answer.needsReview,
      })),
    });

    await tx.ujianAttempt.update({
      where: { id: attempt.id },
      data: { status: needsReview ? "NEEDS_REVIEW" : "FINAL", submittedAt: new Date(), hasilUjianId: hasil.id, draftAnswers: Prisma.JsonNull, draftSavedAt: null },
    });

    await tx.auditLog.create({ data: { actorId: actor.id, action: "UJIAN_ATTEMPT_SUBMITTED", entityType: "UjianAttempt", entityId: attempt.id } });

    return hasil;
  });

  await syncActivityCompletionForExam(attempt.ujianId, attempt.siswaId);

  return { item };
}

export async function submitWaliAttempt(actor: Actor, attemptId: string, input: unknown) {
  const profile = await getWaliProfile(actor);
  return finalizeAttempt({ kind: "WALI", waliProfileId: profile.id }, actor, attemptId, input);
}

export async function submitStudentAttempt(actor: Actor, attemptId: string, input: unknown) {
  const account = await getStudentAccount(actor);
  return finalizeAttempt({ kind: "SISWA", siswaAccountId: account.id }, actor, attemptId, input);
}
