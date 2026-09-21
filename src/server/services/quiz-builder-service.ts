import "server-only";
import type { Prisma } from "@prisma/client";
import type { Actor } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/errors/application-error";
import { canManageClass } from "@/server/policies/access-policy";
import { notifyWaliForStudents } from "@/server/services/notification-service";
import { saveQuizFormSchema, type SaveQuizFormInput } from "@/server/validation/quiz-builder";

type Tx = Prisma.TransactionClient;
type QuestionInput = SaveQuizFormInput["questions"][number];

function parseDate(value: string | undefined) {
  if (!value) return undefined;
  return new Date(`${value}T00:00:00.000Z`);
}

async function assertClassScope(actor: Actor, kelasId: string) {
  if (actor.role === "ADMIN") return;
  if (actor.role !== "GURU") throw new ForbiddenError();

  const allowed = await canManageClass(actor, kelasId);
  if (!allowed) throw new ForbiddenError("Anda tidak memiliki akses ke kelas ini");
}

async function createQuestions(tx: Tx, ujianId: string, kelasId: string, questions: QuestionInput[], actorId: string) {
  let order = 0;

  for (const question of questions) {
    const soal = await tx.bankSoal.create({
      data: {
        kelasId,
        type: question.type,
        question: question.question,
        expectedAnswer: question.expectedAnswer?.trim() || undefined,
        explanation: question.explanation?.trim() || undefined,
        createdById: actorId,
      },
      select: { id: true },
    });

    if (question.options.length > 0) {
      const correctLabels = question.correctLabels.map((label) => label.toUpperCase());
      await tx.opsiSoal.createMany({
        data: question.options.map((option, index) => ({
          bankSoalId: soal.id,
          label: option.label.toUpperCase(),
          content: option.content,
          isCorrect: correctLabels.includes(option.label.toUpperCase()),
          order: index,
        })),
      });
    }

    await tx.ujianSoal.create({
      data: { ujianId, bankSoalId: soal.id, order, weight: question.points, required: question.required },
    });

    order += 1;
  }
}

export async function getQuizForm(actor: Actor, ujianId: string) {
  const ujian = await prisma.ujian.findUnique({
    where: { id: ujianId },
    select: {
      id: true,
      kelasId: true,
      title: true,
      description: true,
      status: true,
      mode: true,
      deliveryMode: true,
      durationMinutes: true,
      maxAttempts: true,
      shuffleQuestions: true,
      shuffleOptions: true,
      passingScore: true,
      showScoreImmediately: true,
      showAnswersAfterSubmit: true,
      collectRespondentName: true,
      showResultToWali: true,
      availableFrom: true,
      availableUntil: true,
      shareToken: true,
      createdAt: true,
      questions: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          order: true,
          weight: true,
          required: true,
          bankSoal: {
            select: {
              id: true,
              type: true,
              question: true,
              explanation: true,
              expectedAnswer: true,
              options: { orderBy: { order: "asc" }, select: { label: true, content: true, isCorrect: true } },
            },
          },
        },
      },
    },
  });

  if (!ujian) {
    throw new NotFoundError("Kuis tidak ditemukan");
  }

  await assertClassScope(actor, ujian.kelasId);

  return {
    item: {
      ...ujian,
      availableFrom: ujian.availableFrom ? ujian.availableFrom.toISOString().slice(0, 10) : null,
      availableUntil: ujian.availableUntil ? ujian.availableUntil.toISOString().slice(0, 10) : null,
      questions: ujian.questions.map((question) => ({
        id: question.id,
        type: question.bankSoal.type,
        question: question.bankSoal.question,
        explanation: question.bankSoal.explanation,
        expectedAnswer: question.bankSoal.expectedAnswer,
        required: question.required,
        points: Number(question.weight),
        options: question.bankSoal.options.map((option) => ({ label: option.label, content: option.content })),
        correctLabels: question.bankSoal.options.filter((option) => option.isCorrect).map((option) => option.label),
      })),
    },
  };
}

export async function createQuizForm(actor: Actor, input: unknown) {
  const parsed = saveQuizFormSchema.safeParse(input);

  if (!parsed.success) {
    throw new ValidationError("Formulir kuis belum valid", parsed.error.flatten().fieldErrors);
  }

  await assertClassScope(actor, parsed.data.kelasId);

  const item = await prisma.$transaction(async (tx) => {
    const ujian = await tx.ujian.create({
      data: {
        kelasId: parsed.data.kelasId,
        title: parsed.data.title,
        description: parsed.data.description || undefined,
        status: "DRAFT",
        mode: parsed.data.mode,
        deliveryMode: parsed.data.deliveryMode,
        durationMinutes: parsed.data.durationMinutes,
        maxAttempts: parsed.data.maxAttempts,
        shuffleQuestions: parsed.data.shuffleQuestions,
        shuffleOptions: parsed.data.shuffleOptions,
        passingScore: parsed.data.passingScore ?? null,
        showScoreImmediately: parsed.data.showScoreImmediately,
        showAnswersAfterSubmit: parsed.data.showAnswersAfterSubmit,
        collectRespondentName: parsed.data.collectRespondentName,
        showResultToWali: parsed.data.showResultToWali,
        availableFrom: parseDate(parsed.data.availableFrom),
        availableUntil: parseDate(parsed.data.availableUntil),
        createdById: actor.id,
      },
      select: { id: true, title: true, status: true },
    });

    await createQuestions(tx, ujian.id, parsed.data.kelasId, parsed.data.questions, actor.id);
    await tx.auditLog.create({ data: { actorId: actor.id, action: "QUIZ_FORM_CREATED", entityType: "Ujian", entityId: ujian.id } });

    return ujian;
  });

  return { item };
}

export async function updateQuizForm(actor: Actor, ujianId: string, input: unknown) {
  const parsed = saveQuizFormSchema.safeParse(input);

  if (!parsed.success) {
    throw new ValidationError("Formulir kuis belum valid", parsed.error.flatten().fieldErrors);
  }

  const existing = await prisma.ujian.findUnique({
    where: { id: ujianId },
    select: { id: true, kelasId: true, status: true, _count: { select: { attempts: true, results: true, responses: true } } },
  });

  if (!existing) {
    throw new NotFoundError("Kuis tidak ditemukan");
  }

  await assertClassScope(actor, existing.kelasId);
  await assertClassScope(actor, parsed.data.kelasId);

  if (existing.status === "PUBLISHED" && (existing._count.attempts > 0 || existing._count.results > 0 || existing._count.responses > 0)) {
    throw new ConflictError("Kuis sudah dikerjakan. Duplikat kuis untuk mengubah soal.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.ujian.update({
      where: { id: ujianId },
      data: {
        kelasId: parsed.data.kelasId,
        title: parsed.data.title,
        description: parsed.data.description || undefined,
        mode: parsed.data.mode,
        deliveryMode: parsed.data.deliveryMode,
        durationMinutes: parsed.data.durationMinutes,
        maxAttempts: parsed.data.maxAttempts,
        shuffleQuestions: parsed.data.shuffleQuestions,
        shuffleOptions: parsed.data.shuffleOptions,
        passingScore: parsed.data.passingScore ?? null,
        showScoreImmediately: parsed.data.showScoreImmediately,
        showAnswersAfterSubmit: parsed.data.showAnswersAfterSubmit,
        collectRespondentName: parsed.data.collectRespondentName,
        showResultToWali: parsed.data.showResultToWali,
        availableFrom: parseDate(parsed.data.availableFrom),
        availableUntil: parseDate(parsed.data.availableUntil),
      },
    });

    const previousQuestions = await tx.ujianSoal.findMany({ where: { ujianId }, select: { bankSoalId: true } });
    await tx.ujianSoal.deleteMany({ where: { ujianId } });

    for (const previous of previousQuestions) {
      const stillUsed = await tx.ujianSoal.count({ where: { bankSoalId: previous.bankSoalId } });
      const answered = await tx.jawabanUjian.count({ where: { bankSoalId: previous.bankSoalId } });
      if (stillUsed === 0 && answered === 0) {
        await tx.opsiSoal.deleteMany({ where: { bankSoalId: previous.bankSoalId } });
        await tx.bankSoal.delete({ where: { id: previous.bankSoalId } }).catch(() => undefined);
      }
    }

    await createQuestions(tx, ujianId, parsed.data.kelasId, parsed.data.questions, actor.id);
    await tx.auditLog.create({ data: { actorId: actor.id, action: "QUIZ_FORM_UPDATED", entityType: "Ujian", entityId: ujianId } });
  });

  return { item: { id: ujianId } };
}

export async function publishQuizForm(actor: Actor, ujianId: string) {
  const ujian = await prisma.ujian.findUnique({
    where: { id: ujianId },
    select: { id: true, kelasId: true, title: true, status: true, deliveryMode: true },
  });

  if (!ujian) {
    throw new NotFoundError("Kuis tidak ditemukan");
  }

  await assertClassScope(actor, ujian.kelasId);

  if (ujian.status !== "PUBLISHED") {
    const questionCount = await prisma.ujianSoal.count({ where: { ujianId } });
    if (questionCount === 0) {
      throw new ValidationError("Tambahkan minimal satu soal sebelum publikasi");
    }

    await prisma.ujian.update({ where: { id: ujianId }, data: { status: "PUBLISHED" } });
    await prisma.auditLog.create({ data: { actorId: actor.id, action: "QUIZ_FORM_PUBLISHED", entityType: "Ujian", entityId: ujianId } });

    if (["ONLINE_VIA_WALI", "BOTH"].includes(ujian.deliveryMode)) {
      const students = await prisma.kelasSiswa.findMany({ where: { kelasId: ujian.kelasId, status: "ACTIVE" }, select: { siswaId: true } });
      await notifyWaliForStudents({
        siswaIds: students.map((student) => student.siswaId),
        template: "online-exam-published",
        subject: `Tugas baru: ${ujian.title}`,
        body: `Ujian online ${ujian.title} sudah tersedia untuk dikerjakan melalui menu Tugas Anak.`,
        metadata: { ujianId: ujian.id },
      });
    }
  }

  return { item: { id: ujian.id, status: "PUBLISHED" as const } };
}
