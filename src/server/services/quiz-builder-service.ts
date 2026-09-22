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

async function createSectionsAndQuestions(tx: Tx, ujianId: string, kelasId: string, data: { sections: Array<{ title: string; description?: string }>; questions: QuestionInput[] }, actorId: string) {
  const sectionIds = new Map<number, string>();
  for (const [index, section] of data.sections.entries()) {
    const created = await tx.ujianSection.create({
      data: { ujianId, order: index, title: section.title, description: section.description || undefined },
      select: { id: true },
    });
    sectionIds.set(index, created.id);
  }

  let order = 0;
  for (const [sectionIndex, sectionId] of sectionIds) {
    for (const question of data.questions.filter((item) => item.sectionIndex === sectionIndex)) {
      const soal = await tx.bankSoal.create({
        data: {
          kelasId,
          type: question.type,
          question: question.question,
          expectedAnswer: question.expectedAnswer?.trim() || undefined,
          mediaUrl: question.mediaUrl?.trim() || undefined,
          explanation: question.explanation?.trim() || undefined,
          allowOther: question.type === "PILIHAN_GANDA" || question.type === "MULTI_SELECT" ? question.allowOther : false,
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
        data: {
          ujianId,
          bankSoalId: soal.id,
          order,
          weight: question.points,
          required: question.required,
          sectionId,
          branchRules: question.branchRules.length > 0 ? (question.branchRules as Prisma.InputJsonValue) : undefined,
        },
      });

      order += 1;
    }
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
      sections: { orderBy: { order: "asc" }, select: { id: true, order: true, title: true, description: true } },
      questions: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          order: true,
          weight: true,
          required: true,
          sectionId: true,
          branchRules: true,
          bankSoal: {
            select: {
              id: true,
              type: true,
              question: true,
              explanation: true,
              expectedAnswer: true,
              mediaUrl: true,
              allowOther: true,
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

  const sectionIndexById = new Map(ujian.sections.map((section, index) => [section.id, index]));

  return {
    item: {
      ...ujian,
      availableFrom: ujian.availableFrom ? ujian.availableFrom.toISOString().slice(0, 10) : null,
      availableUntil: ujian.availableUntil ? ujian.availableUntil.toISOString().slice(0, 10) : null,
      sections: ujian.sections.map((section) => ({ title: section.title, description: section.description })),
      questions: ujian.questions.map((question) => ({
        id: question.id,
        type: question.bankSoal.type,
        question: question.bankSoal.question,
        explanation: question.bankSoal.explanation,
        expectedAnswer: question.bankSoal.expectedAnswer,
        required: question.required,
        points: Number(question.weight),
        mediaUrl: question.bankSoal.mediaUrl,
        allowOther: question.bankSoal.allowOther,
        sectionIndex: question.sectionId ? (sectionIndexById.get(question.sectionId) ?? 0) : 0,
        branchRules: Array.isArray(question.branchRules) ? question.branchRules : [],
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

    await createSectionsAndQuestions(tx, ujian.id, parsed.data.kelasId, { sections: parsed.data.sections, questions: parsed.data.questions }, actor.id);
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
    await tx.ujianSection.deleteMany({ where: { ujianId } });

    for (const previous of previousQuestions) {
      const stillUsed = await tx.ujianSoal.count({ where: { bankSoalId: previous.bankSoalId } });
      const answered = await tx.jawabanUjian.count({ where: { bankSoalId: previous.bankSoalId } });
      if (stillUsed === 0 && answered === 0) {
        await tx.opsiSoal.deleteMany({ where: { bankSoalId: previous.bankSoalId } });
        await tx.bankSoal.delete({ where: { id: previous.bankSoalId } }).catch(() => undefined);
      }
    }

    await createSectionsAndQuestions(tx, ujianId, parsed.data.kelasId, { sections: parsed.data.sections, questions: parsed.data.questions }, actor.id);
    await tx.auditLog.create({ data: { actorId: actor.id, action: "QUIZ_FORM_UPDATED", entityType: "Ujian", entityId: ujianId } });
  });

  return { item: { id: ujianId } };
}

function gradeAnswer(
  bankSoal: { type: string; expectedAnswer: string | null; options: { label: string; isCorrect: boolean }[] },
  answer: { selectedOption?: string; selectedOptions?: string[]; shortAnswer?: string } | undefined,
) {
  const correctLabels = bankSoal.options.filter((option) => option.isCorrect).map((option) => option.label.toUpperCase()).sort();

  if (bankSoal.type === "PILIHAN_GANDA") {
    const selected = (answer?.selectedOption || "").toUpperCase();
    return selected ? correctLabels[0] === selected : null;
  }
  if (bankSoal.type === "MULTI_SELECT") {
    const selected = [...(answer?.selectedOptions || [])].map((label) => label.toUpperCase()).sort();
    return selected.length > 0 ? JSON.stringify(selected) === JSON.stringify(correctLabels) : null;
  }
  if (bankSoal.type === "BENAR_SALAH") {
    const selected = (answer?.selectedOption || "").trim().toLowerCase();
    return selected ? selected === (bankSoal.expectedAnswer || "").trim().toLowerCase() : null;
  }
  if (["ISIAN_SINGKAT", "CLOZE", "GAMBAR", "LISTENING", "READING"].includes(bankSoal.type)) {
    const selected = (answer?.shortAnswer || "").trim().toLowerCase().replace(/\s+/g, " ");
    return selected ? selected === (bankSoal.expectedAnswer || "").trim().toLowerCase().replace(/\s+/g, " ") : null;
  }
  return null;
}

export async function getQuizResponses(actor: Actor, ujianId: string) {
  const ujian = await prisma.ujian.findUnique({
    where: { id: ujianId },
    select: {
      id: true,
      title: true,
      kelasId: true,
      status: true,
      passingScore: true,
      questions: {
        orderBy: { order: "asc" },
        select: { id: true, weight: true, bankSoal: { select: { type: true, question: true, expectedAnswer: true, options: { select: { label: true, isCorrect: true } } } } },
      },
    },
  });

  if (!ujian) {
    throw new NotFoundError("Kuis tidak ditemukan");
  }

  await assertClassScope(actor, ujian.kelasId);

  const [responses, attempts, hasil] = await Promise.all([
    prisma.quizResponse.findMany({
      where: { ujianId },
      orderBy: { createdAt: "desc" },
      select: { id: true, respondentName: true, status: true, score: true, passed: true, submittedAt: true, finalAnswers: true },
    }),
    prisma.ujianAttempt.findMany({
      where: { ujianId },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, submittedAt: true, siswaId: true, siswa: { select: { name: true } } },
    }),
    prisma.hasilUjian.findMany({ where: { ujianId }, select: { siswaId: true, totalScore: true } }),
  ]);

  const scoreByStudent = new Map(hasil.map((item) => [item.siswaId, item.totalScore === null ? null : Number(item.totalScore)]));

  const scored = responses.filter((response) => response.score !== null);
  const averageScore = scored.length > 0 ? Number((scored.reduce((sum, response) => sum + Number(response.score), 0) / scored.length).toFixed(2)) : null;

  const questionStats = ujian.questions.map((question) => {
    let correct = 0;
    let answered = 0;

    for (const response of responses) {
      const answers = Array.isArray(response.finalAnswers) ? (response.finalAnswers as Array<Record<string, unknown>>) : [];
      const answer = answers.find((item) => item && item.ujianSoalId === question.id);
      const verdict = gradeAnswer(question.bankSoal, answer as never);
      if (verdict !== null) {
        answered += 1;
        if (verdict) correct += 1;
      }
    }

    return { id: question.id, question: question.bankSoal.question, type: question.bankSoal.type, correct, answered };
  });

  return {
    quiz: { id: ujian.id, title: ujian.title, status: ujian.status, passingScore: ujian.passingScore },
    stats: {
      responses: responses.length,
      attempts: attempts.length,
      averageScore,
      passed: responses.filter((response) => response.passed === true).length,
      needsReview: responses.filter((response) => response.status === "NEEDS_REVIEW").length,
    },
    questionStats,
    responses: responses.map((response) => ({
      id: response.id,
      respondentName: response.respondentName,
      status: response.status,
      score: response.score === null ? null : Number(response.score),
      passed: response.passed,
      submittedAt: response.submittedAt,
    })),
    attempts: attempts.map((attempt) => ({
      id: attempt.id,
      siswaName: attempt.siswa.name,
      status: attempt.status,
      score: scoreByStudent.get(attempt.siswaId) ?? null,
      submittedAt: attempt.submittedAt,
    })),
  };
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
