import "server-only";
import type { Prisma } from "@prisma/client";
import type { Actor } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { ForbiddenError, ValidationError } from "@/server/errors/application-error";
import { canManageClass } from "@/server/policies/access-policy";
import { createBankSoalSchema, createUjianSchema, submitHasilUjianSchema } from "@/server/validation/exam";
import { notifyWaliForStudents } from "@/server/services/notification-service";

const optionBasedTypes = new Set(["PILIHAN_GANDA", "MULTI_SELECT"]);
const manualReviewTypes = new Set(["SPEAKING", "WRITING", "ROLEPLAY", "ESAI"]);

function normalizeText(value: string | undefined) {
  return (value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function sortedLabels(values: string[] | undefined) {
  return [...new Set((values || []).map((value) => value.trim().toUpperCase()).filter(Boolean))].sort();
}

function jsonEquals(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function getStructuredAnswerKey(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return undefined;
  }

  return (payload as { answerKey?: unknown }).answerKey;
}

function toInputJson(value: unknown) {
  return value === undefined ? undefined : value as Prisma.InputJsonValue;
}

async function assertQuestionScope(actor: Actor, kelasId?: string | null) {
  if (actor.role === "ADMIN") {
    return;
  }

  if (actor.role !== "GURU") {
    throw new ForbiddenError();
  }

  if (!kelasId) {
    return;
  }

  const allowed = await canManageClass(actor, kelasId);

  if (!allowed) {
    throw new ForbiddenError("Anda tidak memiliki akses ke kelas ini");
  }
}

export async function listBankSoal(actor: Actor) {
  if (actor.role === "WALI") {
    throw new ForbiddenError();
  }

  const where = actor.role === "ADMIN"
    ? {}
    : {
        OR: [
          { kelasId: null },
          { kelas: { guruProfile: { userId: actor.id } } },
        ],
      };

  const items = await prisma.bankSoal.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      type: true,
      question: true,
      stimulusText: true,
      mediaUrl: true,
      expectedAnswer: true,
      structuredPayload: true,
      rubric: true,
      language: true,
      direction: true,
      cognitiveLevel: true,
      skill: true,
      difficulty: true,
      standard: true,
      assessmentType: true,
      createdAt: true,
      kelas: { select: { id: true, name: true, program: { select: { name: true } } } },
      options: { orderBy: { order: "asc" }, select: { id: true, label: true, content: true, isCorrect: true } },
    },
  });

  return { items };
}

export async function createBankSoal(actor: Actor, input: unknown) {
  const parsed = createBankSoalSchema.safeParse(input);

  if (!parsed.success) {
    throw new ValidationError("Data soal belum valid", parsed.error.flatten().fieldErrors);
  }

  const kelasId = parsed.data.kelasId || undefined;
  await assertQuestionScope(actor, kelasId);

  if (parsed.data.type === "PILIHAN_GANDA") {
    if (parsed.data.options.length < 2) {
      throw new ValidationError("Soal pilihan ganda minimal memiliki dua opsi");
    }

    if (parsed.data.options.filter((option) => option.isCorrect).length !== 1) {
      throw new ValidationError("Soal pilihan ganda harus memiliki tepat satu opsi benar");
    }
  }

  if (parsed.data.type === "MULTI_SELECT") {
    if (parsed.data.options.length < 2) {
      throw new ValidationError("Soal multi-select minimal memiliki dua opsi");
    }

    if (parsed.data.options.filter((option) => option.isCorrect).length < 1) {
      throw new ValidationError("Soal multi-select minimal memiliki satu opsi benar");
    }
  }

  if (parsed.data.type === "BENAR_SALAH") {
    const expectedAnswer = normalizeText(parsed.data.expectedAnswer);

    if (!["true", "false", "benar", "salah"].includes(expectedAnswer)) {
      throw new ValidationError("Soal benar/salah harus memiliki kunci: benar atau salah");
    }
  }

  if (manualReviewTypes.has(parsed.data.type) && parsed.data.options.length > 0) {
    throw new ValidationError("Soal performa/esai tidak boleh memiliki opsi jawaban");
  }

  const item = await prisma.$transaction(async (tx) => {
    const soal = await tx.bankSoal.create({
      data: {
        kelasId,
        type: parsed.data.type,
        question: parsed.data.question,
        stimulusText: parsed.data.stimulusText || undefined,
        mediaUrl: parsed.data.mediaUrl || undefined,
        expectedAnswer: parsed.data.expectedAnswer || undefined,
        structuredPayload: toInputJson(parsed.data.structuredPayload),
        rubric: toInputJson(parsed.data.rubric),
        language: parsed.data.language || undefined,
        direction: parsed.data.direction || undefined,
        cognitiveLevel: parsed.data.cognitiveLevel,
        skill: parsed.data.skill,
        difficulty: parsed.data.difficulty,
        standard: parsed.data.standard || undefined,
        assessmentType: parsed.data.assessmentType,
        explanation: parsed.data.explanation || undefined,
        createdById: actor.id,
      },
      select: { id: true, type: true },
    });

    if (optionBasedTypes.has(parsed.data.type)) {
      await tx.opsiSoal.createMany({
        data: parsed.data.options.map((option, index) => ({
          bankSoalId: soal.id,
          label: option.label.toUpperCase(),
          content: option.content,
          isCorrect: option.isCorrect,
          order: index,
        })),
      });
    }

    await tx.auditLog.create({
      data: { actorId: actor.id, action: "BANK_SOAL_CREATED", entityType: "BankSoal", entityId: soal.id },
    });

    return soal;
  });

  return { item };
}

function parseDate(value: string | undefined) {
  return value ? new Date(`${value}T00:00:00.000Z`) : undefined;
}

export async function listUjian(actor: Actor) {
  if (actor.role === "WALI") {
    throw new ForbiddenError();
  }

  const where = actor.role === "ADMIN"
    ? {}
    : { kelas: { guruProfile: { userId: actor.id } } };

  const items = await prisma.ujian.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      deliveryMode: true,
      examDate: true,
      availableFrom: true,
      availableUntil: true,
      durationMinutes: true,
      maxAttempts: true,
      showResultToWali: true,
      kelas: { select: { id: true, name: true, program: { select: { name: true } } } },
      questions: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          order: true,
          weight: true,
          bankSoal: { select: { id: true, type: true, question: true } },
        },
      },
      _count: { select: { results: true, attempts: true } },
    },
  });

  return { items };
}

export async function createUjian(actor: Actor, input: unknown) {
  const parsed = createUjianSchema.safeParse(input);

  if (!parsed.success) {
    throw new ValidationError("Data ujian belum valid", parsed.error.flatten().fieldErrors);
  }

  await assertQuestionScope(actor, parsed.data.kelasId);

  const uniqueQuestionIds = new Set(parsed.data.questions.map((question) => question.bankSoalId));

  if (uniqueQuestionIds.size !== parsed.data.questions.length) {
    throw new ValidationError("Soal ujian tidak boleh duplikat");
  }

  const bankSoal = await prisma.bankSoal.findMany({
    where: {
      id: { in: [...uniqueQuestionIds] },
      OR: [{ kelasId: null }, { kelasId: parsed.data.kelasId }],
    },
    select: { id: true },
  });

  if (bankSoal.length !== uniqueQuestionIds.size) {
    throw new ValidationError("Ada soal yang tidak tersedia untuk kelas ujian ini");
  }

  const item = await prisma.$transaction(async (tx) => {
    const ujian = await tx.ujian.create({
      data: {
        kelasId: parsed.data.kelasId,
        title: parsed.data.title,
        description: parsed.data.description || undefined,
        status: parsed.data.status,
        examDate: parseDate(parsed.data.examDate),
        deliveryMode: parsed.data.deliveryMode,
        availableFrom: parseDate(parsed.data.availableFrom),
        availableUntil: parseDate(parsed.data.availableUntil),
        durationMinutes: parsed.data.durationMinutes,
        maxAttempts: parsed.data.maxAttempts,
        showResultToWali: parsed.data.showResultToWali,
        createdById: actor.id,
      },
      select: { id: true, title: true },
    });

    await tx.ujianSoal.createMany({
      data: parsed.data.questions.map((question, index) => ({
        ujianId: ujian.id,
        bankSoalId: question.bankSoalId,
        order: index,
        weight: question.weight,
      })),
    });

    await tx.auditLog.create({
      data: { actorId: actor.id, action: "UJIAN_CREATED", entityType: "Ujian", entityId: ujian.id },
    });

    return ujian;
  });

  if (parsed.data.status === "PUBLISHED" && ["ONLINE_VIA_WALI", "BOTH"].includes(parsed.data.deliveryMode)) {
    const students = await prisma.kelasSiswa.findMany({ where: { kelasId: parsed.data.kelasId, status: "ACTIVE" }, select: { siswaId: true } });
    await notifyWaliForStudents({
      siswaIds: students.map((student) => student.siswaId),
      template: "online-exam-published",
      subject: `Tugas baru: ${item.title}`,
      body: `Ujian online ${item.title} sudah tersedia untuk dikerjakan melalui menu Tugas Anak.`,
      metadata: { ujianId: item.id },
    });
  }

  return { item };
}

export async function listExamStudents(actor: Actor, ujianId: string) {
  const ujian = await prisma.ujian.findUnique({
    where: { id: ujianId },
    select: { id: true, kelasId: true },
  });

  if (!ujian) {
    throw new ValidationError("Ujian tidak ditemukan");
  }

  await assertQuestionScope(actor, ujian.kelasId);

  const items = await prisma.kelasSiswa.findMany({
    where: { kelasId: ujian.kelasId, status: "ACTIVE" },
    orderBy: { siswa: { name: "asc" } },
    select: { siswa: { select: { id: true, name: true, nomorInduk: true } } },
  });

  return { items: items.map((item) => item.siswa) };
}

export async function getUjianInputContext(actor: Actor, ujianId: string) {
  const ujian = await prisma.ujian.findUnique({
    where: { id: ujianId },
    select: {
      id: true,
      title: true,
      kelasId: true,
      durationMinutes: true,
      kelas: { select: { name: true, program: { select: { name: true } } } },
      questions: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          weight: true,
          bankSoal: {
            select: {
              id: true,
              type: true,
              question: true,
              stimulusText: true,
              mediaUrl: true,
              expectedAnswer: true,
              structuredPayload: true,
              rubric: true,
              direction: true,
              options: { orderBy: { order: "asc" }, select: { label: true, content: true, isCorrect: true } },
            },
          },
        },
      },
    },
  });

  if (!ujian) {
    throw new ValidationError("Ujian tidak ditemukan");
  }

  await assertQuestionScope(actor, ujian.kelasId);
  const students = await listExamStudents(actor, ujianId);

  return { ujian, students: students.items };
}

export async function listHasilUjian(actor: Actor) {
  if (actor.role === "WALI") {
    throw new ForbiddenError();
  }

  const where = actor.role === "ADMIN" ? {} : { ujian: { kelas: { guruProfile: { userId: actor.id } } } };

  const items = await prisma.hasilUjian.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      status: true,
      totalScore: true,
      finalizedAt: true,
      siswa: { select: { id: true, name: true, nomorInduk: true } },
      ujian: { select: { id: true, title: true, kelas: { select: { name: true } } } },
      _count: { select: { answers: true } },
    },
  });

  return { items };
}

export async function submitHasilUjian(actor: Actor, input: unknown) {
  const parsed = submitHasilUjianSchema.safeParse(input);

  if (!parsed.success) {
    throw new ValidationError("Data hasil ujian belum valid", parsed.error.flatten().fieldErrors);
  }

  const ujian = await prisma.ujian.findUnique({
    where: { id: parsed.data.ujianId },
    include: {
      questions: {
        orderBy: { order: "asc" },
        include: {
          bankSoal: { include: { options: true } },
        },
      },
    },
  });

  if (!ujian) {
    throw new ValidationError("Ujian tidak ditemukan");
  }

  await assertQuestionScope(actor, ujian.kelasId);

  const enrollment = await prisma.kelasSiswa.findFirst({
    where: { kelasId: ujian.kelasId, siswaId: parsed.data.siswaId, status: "ACTIVE" },
    select: { id: true },
  });

  if (!enrollment) {
    throw new ValidationError("Siswa tidak aktif di kelas ujian ini");
  }

  const answersByQuestion = new Map(parsed.data.answers.map((answer) => [answer.ujianSoalId, answer]));

  if (answersByQuestion.size !== parsed.data.answers.length) {
    throw new ValidationError("Jawaban ujian tidak boleh duplikat");
  }

  const ujianQuestionIds = new Set(ujian.questions.map((question) => question.id));

  for (const answer of parsed.data.answers) {
    if (!ujianQuestionIds.has(answer.ujianSoalId)) {
      throw new ValidationError("Ada jawaban untuk soal yang bukan bagian dari ujian ini");
    }
  }

  let totalScore = 0;
  let needsReview = false;

  const answerRows = ujian.questions.map((question) => {
    const answer = answersByQuestion.get(question.id);
    const correctOptions = sortedLabels(question.bankSoal.options.filter((option) => option.isCorrect).map((option) => option.label));
    const manualScore = answer?.essayScore === "" || answer?.essayScore === undefined ? undefined : Number(answer.essayScore);

    if (question.bankSoal.type === "PILIHAN_GANDA") {
      const selectedOption = answer?.selectedOption?.toUpperCase() || "";
      const score = selectedOption && correctOptions[0] === selectedOption ? Number(question.weight) : 0;
      totalScore += score;

      return {
        ujianSoalId: question.id,
        bankSoalId: question.bankSoalId,
        selectedOption,
        selectedOptions: undefined,
        shortAnswer: undefined,
        structuredAnswer: undefined,
        essayAnswer: undefined,
        score,
        needsReview: false,
      };
    }

    if (question.bankSoal.type === "MULTI_SELECT") {
      const selectedOptions = sortedLabels(answer?.selectedOptions);
      const score = selectedOptions.length > 0 && jsonEquals(selectedOptions, correctOptions) ? Number(question.weight) : 0;
      totalScore += score;

      return {
        ujianSoalId: question.id,
        bankSoalId: question.bankSoalId,
        selectedOption: undefined,
        selectedOptions,
        shortAnswer: undefined,
        structuredAnswer: undefined,
        essayAnswer: undefined,
        score,
        needsReview: false,
      };
    }

    if (question.bankSoal.type === "BENAR_SALAH") {
      const selectedOption = answer?.selectedOption || "";
      const score = normalizeText(selectedOption) === normalizeText(question.bankSoal.expectedAnswer || undefined) ? Number(question.weight) : 0;
      totalScore += score;

      return {
        ujianSoalId: question.id,
        bankSoalId: question.bankSoalId,
        selectedOption,
        selectedOptions: undefined,
        shortAnswer: undefined,
        structuredAnswer: undefined,
        essayAnswer: undefined,
        score,
        needsReview: false,
      };
    }

    if (["ISIAN_SINGKAT", "CLOZE"].includes(question.bankSoal.type) && question.bankSoal.expectedAnswer) {
      const shortAnswer = answer?.shortAnswer || "";
      const score = normalizeText(shortAnswer) === normalizeText(question.bankSoal.expectedAnswer) ? Number(question.weight) : 0;
      totalScore += score;

      return {
        ujianSoalId: question.id,
        bankSoalId: question.bankSoalId,
        selectedOption: undefined,
        selectedOptions: undefined,
        shortAnswer,
        structuredAnswer: undefined,
        essayAnswer: undefined,
        score,
        needsReview: false,
      };
    }

    const structuredAnswerKey = getStructuredAnswerKey(question.bankSoal.structuredPayload);

    if (["MENJODOHKAN", "URUTAN"].includes(question.bankSoal.type) && structuredAnswerKey !== undefined && answer?.structuredAnswer !== undefined) {
      const score = jsonEquals(answer.structuredAnswer, structuredAnswerKey) ? Number(question.weight) : 0;
      totalScore += score;

      return {
        ujianSoalId: question.id,
        bankSoalId: question.bankSoalId,
        selectedOption: undefined,
        selectedOptions: undefined,
        shortAnswer: undefined,
        structuredAnswer: answer.structuredAnswer,
        essayAnswer: undefined,
        score,
        needsReview: false,
      };
    }

    if (manualScore === undefined) {
      needsReview = true;
    } else {
      totalScore += manualScore;
    }

    return {
      ujianSoalId: question.id,
      bankSoalId: question.bankSoalId,
      selectedOption: undefined,
      selectedOptions: undefined,
      shortAnswer: answer?.shortAnswer || undefined,
      structuredAnswer: answer?.structuredAnswer,
      essayAnswer: answer?.essayAnswer || undefined,
      score: manualScore,
      needsReview: manualScore === undefined,
    };
  });

  const item = await prisma.$transaction(async (tx) => {
    const existing = await tx.hasilUjian.findUnique({
      where: { ujianId_siswaId: { ujianId: parsed.data.ujianId, siswaId: parsed.data.siswaId } },
      select: { id: true },
    });

    if (existing) {
      await tx.jawabanUjian.deleteMany({ where: { hasilUjianId: existing.id } });
    }

    const hasil = existing
      ? await tx.hasilUjian.update({
          where: { id: existing.id },
          data: {
            status: needsReview ? "NEEDS_REVIEW" : "FINAL",
            totalScore,
            finalizedAt: needsReview ? null : new Date(),
            updatedById: actor.id,
          },
          select: { id: true, status: true, totalScore: true },
        })
      : await tx.hasilUjian.create({
          data: {
            ujianId: parsed.data.ujianId,
            siswaId: parsed.data.siswaId,
            status: needsReview ? "NEEDS_REVIEW" : "FINAL",
            totalScore,
            finalizedAt: needsReview ? null : new Date(),
            createdById: actor.id,
            updatedById: actor.id,
          },
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
        structuredAnswer: toInputJson(answer.structuredAnswer),
        essayAnswer: answer.essayAnswer,
        score: answer.score,
        needsReview: answer.needsReview,
      })),
    });

    await tx.auditLog.create({
      data: { actorId: actor.id, action: "HASIL_UJIAN_SUBMITTED", entityType: "HasilUjian", entityId: hasil.id },
    });

    return hasil;
  });

  await notifyWaliForStudents({
    siswaIds: [parsed.data.siswaId],
    template: "exam-result-updated",
    subject: needsReview ? "Jawaban ujian menunggu review" : "Nilai ujian tersedia",
    body: needsReview ? `Jawaban ujian ${ujian.title} sudah diterima dan menunggu review guru.` : `Nilai ujian ${ujian.title} sudah final. Buka menu Nilai untuk melihat hasilnya.`,
    metadata: { ujianId: ujian.id, hasilUjianId: item.id },
  });

  return { item };
}
