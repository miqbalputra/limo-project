import "server-only";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import type { Actor } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/errors/application-error";
import { assertRateLimit } from "@/server/security/rate-limit";
import { storeQuizSubmissionFile } from "@/server/providers/storage/local-storage";
import { canManageClass } from "@/server/policies/access-policy";
import { getQuizMedia } from "@/server/services/quiz-media-service";
import { syncActivityCompletionForExam } from "@/server/services/activity-completion-service";

const onlineDeliveryModes = ["ONLINE_VIA_WALI", "BOTH"];

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

function normalizeText(value: string | undefined) {
  return (value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function sortedLabels(values: string[] | undefined) {
  return [...new Set((values || []).map((value) => value.trim().toUpperCase()).filter(Boolean))].sort();
}

function jsonEquals(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function toInputJson(value: unknown) {
  return value === undefined ? undefined : value as Prisma.InputJsonValue;
}

function shortAnswerProblem(value: string, config: { type?: string; min?: number | null; max?: number | null; pattern?: string | null; message?: string | null }) {
  if (config.type === "NUMBER") {
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return "harus berupa angka";
    if (config.min !== null && config.min !== undefined && numeric < config.min) return `nilai minimal ${config.min}`;
    if (config.max !== null && config.max !== undefined && numeric > config.max) return `nilai maksimal ${config.max}`;
  }
  if (config.type === "LENGTH") {
    if (config.min !== null && config.min !== undefined && value.length < config.min) return `minimal ${config.min} karakter`;
    if (config.max !== null && config.max !== undefined && value.length > config.max) return `maksimal ${config.max} karakter`;
  }
  if (config.type === "TEXT" && config.pattern) {
    try {
      if (!new RegExp(config.pattern).test(value)) return config.message || "format jawaban tidak sesuai";
    } catch {
      return null;
    }
  }
  return null;
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

function onlineExamWhere(siswaId: string) {
  const now = new Date();

  return {
    status: "PUBLISHED" as const,
    deliveryMode: { in: onlineDeliveryModes },
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

async function getStudentTaskRows(waliProfileId: string, siswaId: string) {
  const exams = await prisma.ujian.findMany({
    where: onlineExamWhere(siswaId),
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
        where: { siswaId, waliProfileId },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, status: true, submittedAt: true, hasilUjianId: true, expiresAt: true },
      },
      results: {
        where: { siswaId, ujian: { showResultToWali: true } },
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
          : "NOT_STARTED";

    return { ...exam, latestAttempt: attempt ?? null, result: result ?? null, status };
  });
}

export async function getWaliExamInstruction(actor: Actor, siswaId: string, ujianId: string) {
  await assertWaliCanAccessStudent(actor, siswaId);
  const ujian = await prisma.ujian.findFirst({
    where: { id: ujianId, ...onlineExamWhere(siswaId) },
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

export async function startWaliExamAttempt(actor: Actor, siswaId: string, ujianId: string) {
  const profile = await assertWaliCanAccessStudent(actor, siswaId);
  const ujian = await prisma.ujian.findFirst({
    where: { id: ujianId, ...onlineExamWhere(siswaId) },
    select: { id: true, durationMinutes: true, maxAttempts: true },
  });

  if (!ujian) {
    throw new NotFoundError("Ujian online tidak tersedia untuk anak ini");
  }

  const activeAttempt = await prisma.ujianAttempt.findFirst({
    where: { ujianId, siswaId, status: "IN_PROGRESS" },
    orderBy: { createdAt: "desc" },
    select: { id: true, expiresAt: true, waliProfileId: true },
  });

  if (activeAttempt) {
    if (!activeAttempt.expiresAt || activeAttempt.expiresAt > new Date()) {
      if (activeAttempt.waliProfileId !== profile.id) {
        throw new ConflictError("Ujian sedang dikerjakan oleh Wali lain");
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
        waliProfileId: profile.id,
        status: "IN_PROGRESS",
        expiresAt: new Date(Date.now() + ujian.durationMinutes * 60 * 1000),
      },
      select: { id: true },
    });
  });

  await prisma.auditLog.create({ data: { actorId: actor.id, action: "UJIAN_ATTEMPT_STARTED", entityType: "UjianAttempt", entityId: attempt.id } });

  return { attemptId: attempt.id };
}

export async function getWaliAttemptContext(actor: Actor, attemptId: string) {
  const profile = await getWaliProfile(actor);
  const attempt = await prisma.ujianAttempt.findFirst({
    where: { id: attemptId, waliProfileId: profile.id },
    select: {
      id: true,
      status: true,
      expiresAt: true,
      draftAnswers: true,
      draftSavedAt: true,
      siswa: { select: { id: true, name: true, nomorInduk: true } },
      ujian: {
        select: {
          id: true,
          title: true,
          description: true,
          durationMinutes: true,
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

export async function saveWaliAttemptDraft(actor: Actor, attemptId: string, input: unknown) {
  const profile = await getWaliProfile(actor);
  const parsed = saveAttemptDraftSchema.safeParse(input);

  if (!parsed.success) {
    throw new ValidationError("Draft jawaban belum valid", parsed.error.flatten().fieldErrors);
  }

  const attempt = await prisma.ujianAttempt.findFirst({
    where: { id: attemptId, waliProfileId: profile.id },
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

export async function uploadWaliAttemptFile(actor: Actor, attemptId: string, file: File | null) {
  if (!file) {
    throw new ValidationError("File jawaban wajib dipilih");
  }

  const profile = await getWaliProfile(actor);
  const attempt = await prisma.ujianAttempt.findFirst({
    where: { id: attemptId, waliProfileId: profile.id },
    select: { id: true, status: true, expiresAt: true },
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

  assertRateLimit({ key: `wali-upload:${attempt.id}`, limit: 60, windowMs: 60 * 60 * 1000, message: "Terlalu banyak unggahan. Coba lagi nanti." });

  const stored = await storeQuizSubmissionFile(file, "quiz-submission");
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

export async function submitWaliAttempt(actor: Actor, attemptId: string, input: unknown) {
  const profile = await getWaliProfile(actor);
  const parsed = submitAttemptSchema.safeParse(input);

  if (!parsed.success) {
    throw new ValidationError("Jawaban ujian belum valid", parsed.error.flatten().fieldErrors);
  }

  const attempt = await prisma.ujianAttempt.findFirst({
    where: { id: attemptId, waliProfileId: profile.id },
    include: {
      ujian: {
        include: {
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

  if (attempt.status !== "IN_PROGRESS") {
    throw new ConflictError("Attempt ujian sudah dikumpulkan");
  }

  if (attempt.expiresAt && attempt.expiresAt < new Date()) {
    await prisma.ujianAttempt.update({ where: { id: attempt.id }, data: { status: "EXPIRED" } });
    throw new ConflictError("Waktu pengerjaan ujian sudah habis");
  }

  const answersByQuestion = new Map(parsed.data.answers.map((answer) => [answer.ujianSoalId, answer]));
  const questionIds = new Set(attempt.ujian.questions.map((question) => question.id));

  for (const answer of parsed.data.answers) {
    if (!questionIds.has(answer.ujianSoalId)) {
      throw new ValidationError("Ada jawaban untuk soal yang bukan bagian dari ujian ini");
    }
  }

  for (const question of attempt.ujian.questions) {
    if (question.bankSoal.type !== "ISIAN_SINGKAT") continue;
    const config = (question.bankSoal.structuredPayload as { validation?: { type?: string; min?: number | null; max?: number | null; pattern?: string | null; message?: string | null } } | null)?.validation;
    if (!config?.type || config.type === "NONE") continue;
    const value = (answersByQuestion.get(question.id)?.shortAnswer || "").trim();
    if (!value) continue;
    const problem = shortAnswerProblem(value, config);
    if (problem) {
      throw new ValidationError(`Jawaban untuk "${question.bankSoal.question.slice(0, 60)}" tidak valid: ${problem}`);
    }
  }

  let earnedWeight = 0;
  let needsReview = false;
  const totalWeight = attempt.ujian.questions.reduce((sum, question) => sum + Number(question.weight), 0);

  const answerRows = attempt.ujian.questions.map((question) => {
    const answer = answersByQuestion.get(question.id);
    const correctOptions = sortedLabels(question.bankSoal.options.filter((option) => option.isCorrect).map((option) => option.label));
    const type = question.bankSoal.type;

    if (["PILIHAN_GANDA", "DROPDOWN", "SKALA", "RATING"].includes(type)) {
      const selectedOption = answer?.selectedOption?.toUpperCase() || "";
      const score = selectedOption && correctOptions[0] === selectedOption ? Number(question.weight) : 0;
      earnedWeight += score;
      return { ujianSoalId: question.id, bankSoalId: question.bankSoalId, selectedOption, selectedOptions: undefined, shortAnswer: undefined, essayAnswer: undefined, structuredAnswer: undefined, score, needsReview: false };
    }

    if (type === "MULTI_SELECT") {
      const selectedOptions = sortedLabels(answer?.selectedOptions);
      const score = selectedOptions.length > 0 && jsonEquals(selectedOptions, correctOptions) ? Number(question.weight) : 0;
      earnedWeight += score;
      return { ujianSoalId: question.id, bankSoalId: question.bankSoalId, selectedOption: undefined, selectedOptions, shortAnswer: undefined, essayAnswer: undefined, structuredAnswer: undefined, score, needsReview: false };
    }

    if (type === "GRID") {
      const payload = question.bankSoal.structuredPayload as { rows?: string[]; correct?: Record<string, string> } | null;
      const rows = Array.isArray(payload?.rows) ? payload!.rows : [];
      const given = (answer?.structuredAnswer ?? null) as Record<string, unknown> | null;
      let answered = false;
      let allCorrect = rows.length > 0;
      for (let index = 0; index < rows.length; index += 1) {
        const raw = given ? given[String(index)] : undefined;
        const expected = (payload?.correct?.[String(index)] || "").toUpperCase();
        const selected = Array.isArray(raw) ? raw.map((value) => String(value).toUpperCase()).sort() : raw ? [String(raw).toUpperCase()] : [];
        if (selected.length > 0) answered = true;
        if (!jsonEquals(selected, expected ? [expected] : [])) allCorrect = false;
      }
      const score = answered && allCorrect ? Number(question.weight) : 0;
      if (!answered) {
        needsReview = true;
        return { ujianSoalId: question.id, bankSoalId: question.bankSoalId, selectedOption: undefined, selectedOptions: undefined, shortAnswer: undefined, essayAnswer: undefined, structuredAnswer: toInputJson(answer?.structuredAnswer), score: undefined, needsReview: true };
      }
      earnedWeight += score;
      return { ujianSoalId: question.id, bankSoalId: question.bankSoalId, selectedOption: undefined, selectedOptions: undefined, shortAnswer: undefined, essayAnswer: undefined, structuredAnswer: toInputJson(answer?.structuredAnswer), score, needsReview: false };
    }

    if (type === "BENAR_SALAH") {
      const selectedOption = answer?.selectedOption || "";
      const score = normalizeText(selectedOption) === normalizeText(question.bankSoal.expectedAnswer || undefined) ? Number(question.weight) : 0;
      earnedWeight += score;
      return { ujianSoalId: question.id, bankSoalId: question.bankSoalId, selectedOption, selectedOptions: undefined, shortAnswer: undefined, essayAnswer: undefined, structuredAnswer: undefined, score, needsReview: false };
    }

    if (["ISIAN_SINGKAT", "CLOZE", "GAMBAR", "LISTENING", "READING", "TANGGAL", "WAKTU"].includes(type) && question.bankSoal.expectedAnswer) {
      const shortAnswer = answer?.shortAnswer || "";
      const score = normalizeText(shortAnswer) === normalizeText(question.bankSoal.expectedAnswer) ? Number(question.weight) : 0;
      earnedWeight += score;
      return { ujianSoalId: question.id, bankSoalId: question.bankSoalId, selectedOption: undefined, selectedOptions: undefined, shortAnswer, essayAnswer: undefined, structuredAnswer: undefined, score, needsReview: false };
    }

    needsReview = true;
    return { ujianSoalId: question.id, bankSoalId: question.bankSoalId, selectedOption: undefined, selectedOptions: undefined, shortAnswer: answer?.shortAnswer || undefined, essayAnswer: answer?.essayAnswer || undefined, structuredAnswer: toInputJson(answer?.structuredAnswer), score: undefined, needsReview: true };
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
