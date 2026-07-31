import "server-only";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import type { Actor } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/errors/application-error";

const onlineDeliveryModes = ["ONLINE_VIA_WALI", "BOTH"];

const submitAttemptSchema = z.object({
  answers: z.array(z.object({
    ujianSoalId: z.string().min(8).max(64),
    selectedOption: z.string().trim().max(8).optional().or(z.literal("")),
    selectedOptions: z.array(z.string().trim().max(8)).max(16).optional(),
    shortAnswer: z.string().trim().max(10000).optional().or(z.literal("")),
    essayAnswer: z.string().trim().max(10000).optional().or(z.literal("")),
  })).min(1).max(100),
});

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

export async function listWaliTaskChildren(actor: Actor) {
  const profile = await getWaliProfile(actor);
  const relations = await prisma.waliSiswa.findMany({
    where: { waliProfileId: profile.id, endedAt: null },
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
        select: { id: true, status: true, submittedAt: true, hasilUjianId: true },
      },
      results: {
        where: { siswaId },
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
        : attempt?.status === "IN_PROGRESS"
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
    where: { ujianId, siswaId, waliProfileId: profile.id, status: "IN_PROGRESS" },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  if (activeAttempt) {
    return { attemptId: activeAttempt.id };
  }

  const attemptCount = await prisma.ujianAttempt.count({
    where: { ujianId, siswaId, waliProfileId: profile.id, status: { not: "CANCELLED" } },
  });

  if (attemptCount >= ujian.maxAttempts) {
    throw new ConflictError("Batas pengerjaan ujian sudah tercapai");
  }

  const attempt = await prisma.ujianAttempt.create({
    data: {
      ujianId,
      siswaId,
      waliProfileId: profile.id,
      status: "IN_PROGRESS",
      expiresAt: new Date(Date.now() + ujian.durationMinutes * 60 * 1000),
    },
    select: { id: true },
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
              bankSoal: {
                select: {
                  type: true,
                  question: true,
                  stimulusText: true,
                  mediaUrl: true,
                  direction: true,
                  options: { orderBy: { order: "asc" }, select: { label: true, content: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!attempt) {
    throw new NotFoundError("Attempt ujian tidak ditemukan");
  }

  return { attempt };
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

  let totalScore = 0;
  let needsReview = false;

  const answerRows = attempt.ujian.questions.map((question) => {
    const answer = answersByQuestion.get(question.id);
    const correctOptions = sortedLabels(question.bankSoal.options.filter((option) => option.isCorrect).map((option) => option.label));

    if (question.bankSoal.type === "PILIHAN_GANDA") {
      const selectedOption = answer?.selectedOption?.toUpperCase() || "";
      const score = selectedOption && correctOptions[0] === selectedOption ? Number(question.weight) : 0;
      totalScore += score;
      return { ujianSoalId: question.id, bankSoalId: question.bankSoalId, selectedOption, selectedOptions: undefined, shortAnswer: undefined, essayAnswer: undefined, score, needsReview: false };
    }

    if (question.bankSoal.type === "MULTI_SELECT") {
      const selectedOptions = sortedLabels(answer?.selectedOptions);
      const score = selectedOptions.length > 0 && jsonEquals(selectedOptions, correctOptions) ? Number(question.weight) : 0;
      totalScore += score;
      return { ujianSoalId: question.id, bankSoalId: question.bankSoalId, selectedOption: undefined, selectedOptions, shortAnswer: undefined, essayAnswer: undefined, score, needsReview: false };
    }

    if (question.bankSoal.type === "BENAR_SALAH") {
      const selectedOption = answer?.selectedOption || "";
      const score = normalizeText(selectedOption) === normalizeText(question.bankSoal.expectedAnswer || undefined) ? Number(question.weight) : 0;
      totalScore += score;
      return { ujianSoalId: question.id, bankSoalId: question.bankSoalId, selectedOption, selectedOptions: undefined, shortAnswer: undefined, essayAnswer: undefined, score, needsReview: false };
    }

    if (["ISIAN_SINGKAT", "CLOZE", "GAMBAR", "LISTENING", "READING"].includes(question.bankSoal.type) && question.bankSoal.expectedAnswer) {
      const shortAnswer = answer?.shortAnswer || "";
      const score = normalizeText(shortAnswer) === normalizeText(question.bankSoal.expectedAnswer) ? Number(question.weight) : 0;
      totalScore += score;
      return { ujianSoalId: question.id, bankSoalId: question.bankSoalId, selectedOption: undefined, selectedOptions: undefined, shortAnswer, essayAnswer: undefined, score, needsReview: false };
    }

    needsReview = true;
    return { ujianSoalId: question.id, bankSoalId: question.bankSoalId, selectedOption: undefined, selectedOptions: undefined, shortAnswer: answer?.shortAnswer || undefined, essayAnswer: answer?.essayAnswer || undefined, score: undefined, needsReview: true };
  });

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
        essayAnswer: answer.essayAnswer,
        score: answer.score,
        needsReview: answer.needsReview,
      })),
    });

    await tx.ujianAttempt.update({
      where: { id: attempt.id },
      data: { status: needsReview ? "NEEDS_REVIEW" : "FINAL", submittedAt: new Date(), hasilUjianId: hasil.id },
    });

    await tx.auditLog.create({ data: { actorId: actor.id, action: "UJIAN_ATTEMPT_SUBMITTED", entityType: "UjianAttempt", entityId: attempt.id } });

    return hasil;
  });

  return { item };
}
