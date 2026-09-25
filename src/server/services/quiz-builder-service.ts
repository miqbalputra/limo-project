import "server-only";
import type { Prisma } from "@prisma/client";
import type { Actor } from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/server/errors/application-error";
import { canManageClass } from "@/server/policies/access-policy";
import { notifySiswaForStudents, notifyWaliForStudents } from "@/server/services/notification-service";
import { getQuizMedia } from "@/server/services/quiz-media-service";
import { saveQuizFormSchema, importQuestionsSchema, gradeQuizResponseSchema, type SaveQuizFormInput } from "@/server/validation/quiz-builder";
import { gradeObjectiveAnswer, type GradableAnswer } from "@/server/services/quiz-grading";

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

function structuredPayloadFor(question: QuestionInput): Prisma.InputJsonValue | undefined {
  const payload: Record<string, unknown> = {};
  if (question.type === "SKALA" || question.type === "RATING") {
    payload.min = question.scaleMin;
    payload.max = question.scaleMax;
    payload.minLabel = question.scaleMinLabel ?? "";
    payload.maxLabel = question.scaleMaxLabel ?? "";
    payload.kind = question.type === "RATING" ? "rating" : "scale";
  }
  if (question.type === "GRID") {
    const correct: Record<string, string> = {};
    question.gridRows.forEach((_, index) => {
      const label = question.gridCorrect[index];
      if (label) correct[String(index)] = label.toUpperCase();
    });
    payload.rows = question.gridRows;
    payload.multiple = question.gridMultiple;
    payload.correct = correct;
  }
  if (question.type === "ISIAN_SINGKAT" && question.validationType !== "NONE") {
    payload.validation = {
      type: question.validationType,
      min: question.validationMin ?? null,
      max: question.validationMax ?? null,
      pattern: question.validationPattern || null,
      message: question.validationMessage || null,
    };
  }
  return Object.keys(payload).length > 0 ? (payload as Prisma.InputJsonValue) : undefined;
}

function fileUploadFields(value: unknown) {
  const config = value && typeof value === "object" ? (value as { allowedTypes?: unknown; maxSizeMb?: unknown }) : {};
  const allowedTypes = Array.isArray(config.allowedTypes) ? config.allowedTypes.filter((item): item is string => typeof item === "string") : [];
  const maxSizeMb = typeof config.maxSizeMb === "number" && Number.isFinite(config.maxSizeMb) ? config.maxSizeMb : 0;
  return { uploadAllowedTypes: allowedTypes, uploadMaxSizeMb: maxSizeMb };
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
          helpText: question.helpText?.trim() || undefined,
          expectedAnswer: question.expectedAnswer?.trim() || undefined,
          mediaUrl: question.mediaUrl?.trim() || undefined,
          structuredPayload: structuredPayloadFor(question),
          explanation: question.explanation?.trim() || undefined,
          allowOther: question.type === "PILIHAN_GANDA" || question.type === "MULTI_SELECT" || question.type === "DROPDOWN" ? question.allowOther : false,
          shuffleOptions: question.shuffleOptions,
          acceptedAnswers: question.acceptedAnswers.length > 0 ? (question.acceptedAnswers as Prisma.InputJsonValue) : undefined,
          feedbackCorrect: question.feedbackCorrect?.trim() || undefined,
          feedbackIncorrect: question.feedbackIncorrect?.trim() || undefined,
          fileUploadConfig: question.uploadAllowedTypes.length > 0 || question.uploadMaxSizeMb > 0
            ? ({ allowedTypes: question.uploadAllowedTypes, maxSizeMb: question.uploadMaxSizeMb } as Prisma.InputJsonValue)
            : undefined,
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
            mediaUrl: option.mediaUrl?.trim() || undefined,
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
      showResultToSiswa: true,
      secureMode: true,
      themeColor: true,
      headerImageUrl: true,
      confirmationMessage: true,
      collectRespondentEmail: true,
      sendCopyToRespondent: true,
      oneResponsePerEmail: true,
      notifyGuruOnResponse: true,
      presentationMode: true,
      releaseMode: true,
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
              helpText: true,
              explanation: true,
              expectedAnswer: true,
              mediaUrl: true,
              structuredPayload: true,
              allowOther: true,
              shuffleOptions: true,
              acceptedAnswers: true,
              feedbackCorrect: true,
              feedbackIncorrect: true,
              fileUploadConfig: true,
              options: { orderBy: { order: "asc" }, select: { label: true, content: true, mediaUrl: true, isCorrect: true } },
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
      questions: ujian.questions.map((question) => {
        const payload = (question.bankSoal.structuredPayload ?? null) as
          | { min?: number; max?: number; minLabel?: string; maxLabel?: string; rows?: string[]; multiple?: boolean; correct?: Record<string, string>; validation?: { type?: string; min?: number | null; max?: number | null; pattern?: string | null; message?: string | null } }
          | null;
        const rows = Array.isArray(payload?.rows) ? payload!.rows : [];
        return {
          id: question.id,
          type: question.bankSoal.type,
          question: question.bankSoal.question,
          helpText: question.bankSoal.helpText ?? "",
          explanation: question.bankSoal.explanation,
          expectedAnswer: question.bankSoal.expectedAnswer,
          required: question.required,
          points: Number(question.weight),
          mediaUrl: question.bankSoal.mediaUrl,
          allowOther: question.bankSoal.allowOther,
          shuffleOptions: question.bankSoal.shuffleOptions,
          sectionIndex: question.sectionId ? (sectionIndexById.get(question.sectionId) ?? 0) : 0,
          branchRules: Array.isArray(question.branchRules) ? question.branchRules : [],
          scaleMin: payload?.min ?? 1,
          scaleMax: payload?.max ?? 5,
          scaleMinLabel: payload?.minLabel ?? "",
          scaleMaxLabel: payload?.maxLabel ?? "",
          gridRows: rows,
          gridMultiple: Boolean(payload?.multiple),
          gridCorrect: rows.map((_, index) => payload?.correct?.[String(index)] ?? ""),
          validationType: payload?.validation?.type ?? "NONE",
          validationMin: payload?.validation?.min ?? null,
          validationMax: payload?.validation?.max ?? null,
          validationPattern: payload?.validation?.pattern ?? "",
          validationMessage: payload?.validation?.message ?? "",
          acceptedAnswers: Array.isArray(question.bankSoal.acceptedAnswers) ? question.bankSoal.acceptedAnswers.filter((value): value is string => typeof value === "string") : [],
          feedbackCorrect: question.bankSoal.feedbackCorrect ?? "",
          feedbackIncorrect: question.bankSoal.feedbackIncorrect ?? "",
          ...fileUploadFields(question.bankSoal.fileUploadConfig),
          options: question.bankSoal.options.map((option) => ({ label: option.label, content: option.content, mediaUrl: option.mediaUrl })),
          correctLabels: question.bankSoal.options.filter((option) => option.isCorrect).map((option) => option.label),
        };
      }),
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
        showResultToSiswa: parsed.data.showResultToSiswa,
        secureMode: parsed.data.secureMode,
        themeColor: parsed.data.themeColor,
        headerImageUrl: parsed.data.headerImageUrl ? parsed.data.headerImageUrl : null,
        confirmationMessage: parsed.data.confirmationMessage ? parsed.data.confirmationMessage : null,
        collectRespondentEmail: parsed.data.collectRespondentEmail,
        sendCopyToRespondent: parsed.data.sendCopyToRespondent,
        oneResponsePerEmail: parsed.data.oneResponsePerEmail,
        notifyGuruOnResponse: parsed.data.notifyGuruOnResponse,
        presentationMode: parsed.data.presentationMode,
        releaseMode: parsed.data.releaseMode,
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
        showResultToSiswa: parsed.data.showResultToSiswa,
        secureMode: parsed.data.secureMode,
        themeColor: parsed.data.themeColor,
        headerImageUrl: parsed.data.headerImageUrl ? parsed.data.headerImageUrl : null,
        confirmationMessage: parsed.data.confirmationMessage ? parsed.data.confirmationMessage : null,
        collectRespondentEmail: parsed.data.collectRespondentEmail,
        sendCopyToRespondent: parsed.data.sendCopyToRespondent,
        oneResponsePerEmail: parsed.data.oneResponsePerEmail,
        notifyGuruOnResponse: parsed.data.notifyGuruOnResponse,
        presentationMode: parsed.data.presentationMode,
        releaseMode: parsed.data.releaseMode,
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

export function gradeAnswer(
  bankSoal: { type: string; expectedAnswer: string | null; structuredPayload?: unknown; options: { label: string; isCorrect: boolean }[] },
  answer: { selectedOption?: string; selectedOptions?: string[]; shortAnswer?: string; structuredAnswer?: unknown } | undefined,
) {
  const correctLabels = bankSoal.options.filter((option) => option.isCorrect).map((option) => option.label.toUpperCase()).sort();

  if (["PILIHAN_GANDA", "DROPDOWN", "SKALA", "RATING"].includes(bankSoal.type)) {
    const selected = (answer?.selectedOption || "").toUpperCase();
    return selected ? correctLabels[0] === selected : null;
  }
  if (bankSoal.type === "MULTI_SELECT") {
    const selected = [...(answer?.selectedOptions || [])].map((label) => label.toUpperCase()).sort();
    return selected.length > 0 ? JSON.stringify(selected) === JSON.stringify(correctLabels) : null;
  }
  if (bankSoal.type === "GRID") {
    const payload = bankSoal.structuredPayload as { rows?: string[]; correct?: Record<string, string> } | null;
    const rows = Array.isArray(payload?.rows) ? payload!.rows : [];
    const given = answer?.structuredAnswer as Record<string, unknown> | undefined;
    if (rows.length === 0 || !given || typeof given !== "object") return null;
    let answered = false;
    for (let index = 0; index < rows.length; index += 1) {
      const raw = given[String(index)];
      const expected = (payload?.correct?.[String(index)] || "").toUpperCase();
      const selected = Array.isArray(raw) ? raw.map((value) => String(value).toUpperCase()).sort() : raw ? [String(raw).toUpperCase()] : [];
      if (selected.length > 0) answered = true;
      if (JSON.stringify(selected) !== JSON.stringify(expected ? [expected] : [])) return false;
    }
    return answered;
  }
  if (bankSoal.type === "BENAR_SALAH") {
    const selected = (answer?.selectedOption || "").trim().toLowerCase();
    return selected ? selected === (bankSoal.expectedAnswer || "").trim().toLowerCase() : null;
  }
  if (["ISIAN_SINGKAT", "CLOZE", "GAMBAR", "LISTENING", "READING", "TANGGAL", "WAKTU"].includes(bankSoal.type)) {
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
      releaseMode: true,
      questions: {
        orderBy: { order: "asc" },
        select: { id: true, weight: true, bankSoal: { select: { type: true, question: true, expectedAnswer: true, structuredPayload: true, options: { select: { label: true, isCorrect: true } } } } },
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
      select: { id: true, respondentName: true, respondentEmail: true, status: true, score: true, passed: true, scoreReleasedAt: true, submittedAt: true, finalAnswers: true },
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
    quiz: { id: ujian.id, title: ujian.title, status: ujian.status, passingScore: ujian.passingScore, releaseMode: ujian.releaseMode },
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
      respondentEmail: response.respondentEmail,
      status: response.status,
      score: response.score === null ? null : Number(response.score),
      passed: response.passed,
      released: Boolean(response.scoreReleasedAt),
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

export async function releaseQuizResponse(actor: Actor, ujianId: string, responseId: string) {
  const ujian = await prisma.ujian.findUnique({ where: { id: ujianId }, select: { id: true, kelasId: true } });
  if (!ujian) throw new NotFoundError("Kuis tidak ditemukan");
  await assertClassScope(actor, ujian.kelasId);

  const response = await prisma.quizResponse.findFirst({ where: { id: responseId, ujianId }, select: { id: true } });
  if (!response) throw new NotFoundError("Respons tidak ditemukan");

  await prisma.$transaction([
    prisma.quizResponse.update({ where: { id: responseId }, data: { scoreReleasedAt: new Date() } }),
    prisma.auditLog.create({ data: { actorId: actor.id, action: "QUIZ_RESPONSE_RELEASED", entityType: "QuizResponse", entityId: responseId, metadata: { ujianId } } }),
  ]);

  return { success: true };
}

export async function releaseAllQuizResponses(actor: Actor, ujianId: string) {
  const ujian = await prisma.ujian.findUnique({ where: { id: ujianId }, select: { id: true, kelasId: true } });
  if (!ujian) throw new NotFoundError("Kuis tidak ditemukan");
  await assertClassScope(actor, ujian.kelasId);

  const result = await prisma.quizResponse.updateMany({
    where: { ujianId, scoreReleasedAt: null, status: { in: ["SUBMITTED", "NEEDS_REVIEW"] } },
    data: { scoreReleasedAt: new Date() },
  });
  await prisma.auditLog.create({ data: { actorId: actor.id, action: "QUIZ_RESPONSES_RELEASED", entityType: "Ujian", entityId: ujianId, metadata: { count: result.count } } });

  return { released: result.count };
}

export async function importQuizQuestions(actor: Actor, targetUjianId: string, input: unknown) {
  const parsed = importQuestionsSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Permintaan impor belum valid", parsed.error.flatten().fieldErrors);

  const target = await prisma.ujian.findUnique({ where: { id: targetUjianId }, select: { id: true, kelasId: true } });
  if (!target) throw new NotFoundError("Kuis tujuan tidak ditemukan");
  await assertClassScope(actor, target.kelasId);

  const source = await prisma.ujian.findUnique({
    where: { id: parsed.data.sourceUjianId },
    select: {
      id: true,
      questions: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          weight: true,
          required: true,
          bankSoal: {
            select: {
              type: true,
              question: true,
              helpText: true,
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
              allowOther: true,
              shuffleOptions: true,
              explanation: true,
              acceptedAnswers: true,
              feedbackCorrect: true,
              feedbackIncorrect: true,
              fileUploadConfig: true,
              options: { orderBy: { order: "asc" }, select: { label: true, content: true, mediaUrl: true, isCorrect: true, order: true } },
            },
          },
        },
      },
    },
  });
  if (!source) throw new NotFoundError("Kuis sumber tidak ditemukan");

  const questionsToImport = parsed.data.questionIds && parsed.data.questionIds.length > 0
    ? source.questions.filter((question) => parsed.data.questionIds!.includes(question.id))
    : source.questions;
  if (questionsToImport.length === 0) throw new ValidationError("Tidak ada soal yang dipilih");

  const last = await prisma.ujianSoal.aggregate({ where: { ujianId: targetUjianId }, _max: { order: true } });

  await prisma.$transaction(async (tx) => {
    let order = (last._max.order ?? -1) + 1;

    for (const question of questionsToImport) {
      const soal = await tx.bankSoal.create({
        data: {
          kelasId: target.kelasId,
          type: question.bankSoal.type,
          question: question.bankSoal.question,
          helpText: question.bankSoal.helpText ?? undefined,
          stimulusText: question.bankSoal.stimulusText ?? undefined,
          mediaUrl: question.bankSoal.mediaUrl ?? undefined,
          expectedAnswer: question.bankSoal.expectedAnswer ?? undefined,
          structuredPayload: question.bankSoal.structuredPayload ?? undefined,
          rubric: question.bankSoal.rubric ?? undefined,
          language: question.bankSoal.language ?? undefined,
          direction: question.bankSoal.direction ?? undefined,
          cognitiveLevel: question.bankSoal.cognitiveLevel,
          skill: question.bankSoal.skill,
          difficulty: question.bankSoal.difficulty,
          standard: question.bankSoal.standard ?? undefined,
          assessmentType: question.bankSoal.assessmentType,
          allowOther: question.bankSoal.allowOther,
          shuffleOptions: question.bankSoal.shuffleOptions,
          explanation: question.bankSoal.explanation ?? undefined,
          acceptedAnswers: question.bankSoal.acceptedAnswers ?? undefined,
          feedbackCorrect: question.bankSoal.feedbackCorrect ?? undefined,
          feedbackIncorrect: question.bankSoal.feedbackIncorrect ?? undefined,
          fileUploadConfig: question.bankSoal.fileUploadConfig ?? undefined,
          createdById: actor.id,
        },
        select: { id: true },
      });

      if (question.bankSoal.options.length > 0) {
        await tx.opsiSoal.createMany({
          data: question.bankSoal.options.map((option) => ({
            bankSoalId: soal.id,
            label: option.label,
            content: option.content,
            mediaUrl: option.mediaUrl ?? undefined,
            isCorrect: option.isCorrect,
            order: option.order,
          })),
        });
      }

      await tx.ujianSoal.create({
        data: { ujianId: targetUjianId, bankSoalId: soal.id, order, weight: question.weight, required: question.required },
      });
      order += 1;
    }

    await tx.auditLog.create({
      data: { actorId: actor.id, action: "QUIZ_QUESTIONS_IMPORTED", entityType: "Ujian", entityId: targetUjianId, metadata: { sourceUjianId: source.id, count: questionsToImport.length } },
    });
  });

  return { imported: questionsToImport.length };
}

export async function gradeQuizResponse(actor: Actor, ujianId: string, responseId: string, input: unknown) {
  const parsed = gradeQuizResponseSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError("Penilaian belum valid", parsed.error.flatten().fieldErrors);

  const ujian = await prisma.ujian.findUnique({
    where: { id: ujianId },
    select: {
      id: true,
      kelasId: true,
      passingScore: true,
      questions: {
        select: {
          id: true,
          weight: true,
          bankSoal: { select: { type: true, expectedAnswer: true, acceptedAnswers: true, structuredPayload: true, options: { select: { label: true, isCorrect: true } } } },
        },
      },
    },
  });
  if (!ujian) throw new NotFoundError("Kuis tidak ditemukan");
  await assertClassScope(actor, ujian.kelasId);

  const response = await prisma.quizResponse.findUnique({ where: { id: responseId }, select: { id: true, ujianId: true, finalAnswers: true, manualScores: true } });
  if (!response || response.ujianId !== ujianId) throw new NotFoundError("Respons tidak ditemukan");

  const overrides: Record<string, number> = response.manualScores && typeof response.manualScores === "object" && !Array.isArray(response.manualScores)
    ? { ...(response.manualScores as Record<string, number>) }
    : {};
  for (const entry of parsed.data.answers) overrides[entry.ujianSoalId] = entry.score;

  const rawAnswers = Array.isArray(response.finalAnswers) ? (response.finalAnswers as GradableAnswer[]) : [];
  const answerById = new Map(rawAnswers.map((answer) => [answer.ujianSoalId, answer]));

  let earned = 0;
  let total = 0;
  let needsReview = false;

  for (const question of ujian.questions) {
    total += Number(question.weight);
    const manual = overrides[question.id];

    if (typeof manual === "number" && Number.isFinite(manual)) {
      earned += Math.min(Math.max(manual, 0), Number(question.weight));
      continue;
    }

    const correctLabels = question.bankSoal.options.filter((option) => option.isCorrect).map((option) => option.label.toUpperCase()).sort();
    const graded = gradeObjectiveAnswer({
      type: question.bankSoal.type,
      weight: Number(question.weight),
      correctLabels,
      expectedAnswer: question.bankSoal.expectedAnswer ?? null,
      acceptedAnswers: question.bankSoal.acceptedAnswers,
      structuredPayload: question.bankSoal.structuredPayload,
      answer: answerById.get(question.id),
    });

    if (graded.score === null) {
      needsReview = true;
      continue;
    }

    earned += graded.score;
  }

  const percent = total > 0 ? Number(((earned / total) * 100).toFixed(2)) : 0;
  const passingScore = ujian.passingScore;

  const item = await prisma.$transaction(async (tx) => {
    const updated = await tx.quizResponse.update({
      where: { id: responseId },
      data: {
        manualScores: overrides as Prisma.InputJsonValue,
        score: percent,
        maxScore: 100,
        status: needsReview ? "NEEDS_REVIEW" : "SUBMITTED",
        passed: needsReview || passingScore === null ? null : percent >= passingScore,
      },
      select: { id: true, score: true, status: true, passed: true },
    });
    await tx.auditLog.create({ data: { actorId: actor.id, action: "QUIZ_RESPONSE_GRADED", entityType: "QuizResponse", entityId: responseId, metadata: { ujianId, score: percent, needsReview } } });
    return updated;
  });

  return { item: { id: item.id, score: item.score === null ? null : Number(item.score), status: item.status, passed: item.passed, needsReview } };
}

export async function getQuizResponseDetail(actor: Actor, ujianId: string, responseId: string) {
  const ujian = await prisma.ujian.findUnique({
    where: { id: ujianId },
    select: {
      id: true,
      title: true,
      kelasId: true,
      passingScore: true,
      questions: {
        orderBy: { order: "asc" },
        select: {
          id: true,
          weight: true,
          bankSoal: {
            select: {
              type: true,
              question: true,
              expectedAnswer: true,
              structuredPayload: true,
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

  const response = await prisma.quizResponse.findUnique({
    where: { id: responseId },
    select: { id: true, ujianId: true, respondentName: true, status: true, score: true, passed: true, submittedAt: true, finalAnswers: true, draftAnswers: true, manualScores: true },
  });

  if (!response || response.ujianId !== ujianId) {
    throw new NotFoundError("Respons tidak ditemukan");
  }

  const manualScores: Record<string, number> = response.manualScores && typeof response.manualScores === "object" && !Array.isArray(response.manualScores)
    ? { ...(response.manualScores as Record<string, number>) }
    : {};

  const rawAnswers = Array.isArray(response.finalAnswers)
    ? (response.finalAnswers as Array<Record<string, unknown>>)
    : Array.isArray(response.draftAnswers)
      ? (response.draftAnswers as Array<Record<string, unknown>>)
      : [];
  const answerById = new Map(rawAnswers.map((answer) => [String(answer.ujianSoalId), answer]));

  const items = ujian.questions.map((question) => {
    const answer = answerById.get(question.id) as never;
    const correct = gradeAnswer(question.bankSoal, answer as { selectedOption?: string; selectedOptions?: string[]; shortAnswer?: string; structuredAnswer?: unknown } | undefined);
    const record = (answer ?? {}) as Record<string, unknown>;
    const type = question.bankSoal.type;
    let answerText = "-";
    let fileId: string | null = null;

    if (["PILIHAN_GANDA", "DROPDOWN", "SKALA", "RATING", "BENAR_SALAH"].includes(type)) {
      const label = typeof record.selectedOption === "string" ? record.selectedOption : "";
      if (label === "OTHER") {
        answerText = `Lainnya: ${typeof record.shortAnswer === "string" ? record.shortAnswer : ""}`;
      } else if (label) {
        const option = question.bankSoal.options.find((item) => item.label === label);
        answerText = option ? `${label}. ${option.content}` : label;
      }
    } else if (type === "MULTI_SELECT") {
      const labels = Array.isArray(record.selectedOptions) ? (record.selectedOptions as string[]) : [];
      if (labels.includes("OTHER")) {
        answerText = `Lainnya: ${typeof record.shortAnswer === "string" ? record.shortAnswer : ""}`;
      } else if (labels.length > 0) {
        answerText = labels.map((label) => question.bankSoal.options.find((item) => item.label === label)?.content ?? label).join(", ");
      }
    } else if (type === "GRID") {
      const payload = question.bankSoal.structuredPayload as { rows?: string[] } | null;
      const rows = Array.isArray(payload?.rows) ? payload!.rows : [];
      const given = (record.structuredAnswer ?? {}) as Record<string, unknown>;
      const parts = rows.map((row, index) => {
        const value = given[String(index)];
        const selected = Array.isArray(value) ? value.join("/") : value ? String(value) : "-";
        return `${row}: ${selected}`;
      });
      if (parts.length > 0) answerText = parts.join(" | ");
    } else if (type === "FILE_UPLOAD") {
      const stored = (record.structuredAnswer ?? {}) as Record<string, unknown>;
      answerText = typeof stored.name === "string" && stored.name ? stored.name : "-";
      fileId = typeof stored.fileId === "string" ? stored.fileId : null;
    } else {
      answerText = (typeof record.shortAnswer === "string" && record.shortAnswer) || (typeof record.essayAnswer === "string" && record.essayAnswer) || "-";
    }

    return { id: question.id, type, question: question.bankSoal.question, answerText, correct, weight: Number(question.weight), fileId, manualScore: manualScores[question.id] ?? null };
  });

  return {
    quiz: { id: ujian.id, title: ujian.title, passingScore: ujian.passingScore },
    response: {
      id: response.id,
      respondentName: response.respondentName,
      status: response.status,
      score: response.score === null ? null : Number(response.score),
      passed: response.passed,
      submittedAt: response.submittedAt,
    },
    items,
  };
}

export async function getQuizResponseFile(actor: Actor, ujianId: string, responseId: string, fileId: string) {
  const ujian = await prisma.ujian.findUnique({ where: { id: ujianId }, select: { kelasId: true } });
  if (!ujian) {
    throw new NotFoundError("Kuis tidak ditemukan");
  }
  await assertClassScope(actor, ujian.kelasId);

  const response = await prisma.quizResponse.findUnique({ where: { id: responseId }, select: { ujianId: true, finalAnswers: true, draftAnswers: true } });
  if (!response || response.ujianId !== ujianId) {
    throw new NotFoundError("Respons tidak ditemukan");
  }

  const haystack = JSON.stringify(response.finalAnswers ?? response.draftAnswers ?? []);
  if (!haystack.includes(fileId)) {
    throw new NotFoundError("File tidak ditemukan pada respons ini");
  }

  return getQuizMedia(fileId);
}

export async function getQuizResponsesCsv(actor: Actor, ujianId: string) {
  const ujian = await prisma.ujian.findUnique({ where: { id: ujianId }, select: { id: true, kelasId: true } });
  if (!ujian) {
    throw new NotFoundError("Kuis tidak ditemukan");
  }
  await assertClassScope(actor, ujian.kelasId);

  const responses = await prisma.quizResponse.findMany({
    where: { ujianId },
    orderBy: { createdAt: "asc" },
    select: { respondentName: true, status: true, score: true, passed: true, submittedAt: true },
  });

  const header = ["Nama", "Status", "Skor", "Lulus", "Dikirim"];
  const rows = responses.map((response) => [
    response.respondentName,
    response.status,
    response.score === null ? "" : String(Number(response.score)),
    response.passed === null ? "" : response.passed ? "Ya" : "Tidak",
    response.submittedAt ? response.submittedAt.toISOString() : "",
  ]);
  const escapeCell = (value: string) => (/[",\n\r;]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  const csv = [header, ...rows].map((row) => row.map(escapeCell).join(",")).join("\r\n");

  return { filename: `limo-respons-kuis-${ujian.id}.csv`, content: `\uFEFF${csv}` };
}

export async function duplicateQuizForm(actor: Actor, ujianId: string) {
  const source = await prisma.ujian.findUnique({
    where: { id: ujianId },
    select: {
      id: true,
      kelasId: true,
      title: true,
      description: true,
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
      showResultToSiswa: true,
      secureMode: true,
      themeColor: true,
      headerImageUrl: true,
      confirmationMessage: true,
      collectRespondentEmail: true,
      sendCopyToRespondent: true,
      oneResponsePerEmail: true,
      notifyGuruOnResponse: true,
      presentationMode: true,
      releaseMode: true,
      availableFrom: true,
      availableUntil: true,
      sections: { orderBy: { order: "asc" }, select: { id: true, order: true, title: true, description: true } },
      questions: {
        orderBy: { order: "asc" },
        select: {
          order: true,
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
              allowOther: true,
              shuffleOptions: true,
              explanation: true,
              acceptedAnswers: true,
              feedbackCorrect: true,
              feedbackIncorrect: true,
              fileUploadConfig: true,
              options: { orderBy: { order: "asc" }, select: { label: true, content: true, mediaUrl: true, isCorrect: true, order: true } },
            },
          },
        },
      },
    },
  });

  if (!source) {
    throw new NotFoundError("Kuis tidak ditemukan");
  }

  await assertClassScope(actor, source.kelasId);

  const item = await prisma.$transaction(async (tx) => {
    const ujian = await tx.ujian.create({
      data: {
        kelasId: source.kelasId,
        title: `${source.title} (salinan)`.slice(0, 200),
        description: source.description ?? undefined,
        status: "DRAFT",
        mode: source.mode,
        deliveryMode: source.deliveryMode,
        durationMinutes: source.durationMinutes,
        maxAttempts: source.maxAttempts,
        shuffleQuestions: source.shuffleQuestions,
        shuffleOptions: source.shuffleOptions,
        passingScore: source.passingScore,
        showScoreImmediately: source.showScoreImmediately,
        showAnswersAfterSubmit: source.showAnswersAfterSubmit,
        collectRespondentName: source.collectRespondentName,
        showResultToWali: source.showResultToWali,
        showResultToSiswa: source.showResultToSiswa,
        secureMode: source.secureMode,
        themeColor: source.themeColor,
        headerImageUrl: source.headerImageUrl ?? undefined,
        confirmationMessage: source.confirmationMessage ?? undefined,
        collectRespondentEmail: source.collectRespondentEmail,
        sendCopyToRespondent: source.sendCopyToRespondent,
        oneResponsePerEmail: source.oneResponsePerEmail,
        notifyGuruOnResponse: source.notifyGuruOnResponse,
        presentationMode: source.presentationMode,
        releaseMode: source.releaseMode,
        availableFrom: source.availableFrom,
        availableUntil: source.availableUntil,
        createdById: actor.id,
      },
      select: { id: true },
    });

    const sectionIdByOrder = new Map<number, string>();
    for (const section of source.sections) {
      const created = await tx.ujianSection.create({
        data: { ujianId: ujian.id, order: section.order, title: section.title, description: section.description ?? undefined },
        select: { id: true },
      });
      sectionIdByOrder.set(section.order, created.id);
    }
    const orderBySectionId = new Map(source.sections.map((section) => [section.id, section.order]));

    for (const question of source.questions) {
      const soal = await tx.bankSoal.create({
        data: {
          kelasId: source.kelasId,
          type: question.bankSoal.type,
          question: question.bankSoal.question,
          helpText: question.bankSoal.helpText ?? undefined,
          stimulusText: question.bankSoal.stimulusText ?? undefined,
          mediaUrl: question.bankSoal.mediaUrl ?? undefined,
          expectedAnswer: question.bankSoal.expectedAnswer ?? undefined,
          structuredPayload: question.bankSoal.structuredPayload ?? undefined,
          rubric: question.bankSoal.rubric ?? undefined,
          language: question.bankSoal.language ?? undefined,
          direction: question.bankSoal.direction ?? undefined,
          cognitiveLevel: question.bankSoal.cognitiveLevel,
          skill: question.bankSoal.skill,
          difficulty: question.bankSoal.difficulty,
          standard: question.bankSoal.standard ?? undefined,
          assessmentType: question.bankSoal.assessmentType,
          allowOther: question.bankSoal.allowOther,
          shuffleOptions: question.bankSoal.shuffleOptions,
          explanation: question.bankSoal.explanation ?? undefined,
          acceptedAnswers: question.bankSoal.acceptedAnswers ?? undefined,
          feedbackCorrect: question.bankSoal.feedbackCorrect ?? undefined,
          feedbackIncorrect: question.bankSoal.feedbackIncorrect ?? undefined,
          fileUploadConfig: question.bankSoal.fileUploadConfig ?? undefined,
          createdById: actor.id,
        },
        select: { id: true },
      });

      if (question.bankSoal.options.length > 0) {
        await tx.opsiSoal.createMany({
          data: question.bankSoal.options.map((option) => ({
            bankSoalId: soal.id,
            label: option.label,
            content: option.content,
            mediaUrl: option.mediaUrl ?? undefined,
            isCorrect: option.isCorrect,
            order: option.order,
          })),
        });
      }

      const sectionOrder = question.sectionId ? orderBySectionId.get(question.sectionId) : undefined;
      await tx.ujianSoal.create({
        data: {
          ujianId: ujian.id,
          bankSoalId: soal.id,
          order: question.order,
          weight: question.weight,
          required: question.required,
          sectionId: sectionOrder !== undefined ? (sectionIdByOrder.get(sectionOrder) ?? null) : null,
          branchRules: question.branchRules ?? undefined,
        },
      });
    }

    await tx.auditLog.create({ data: { actorId: actor.id, action: "QUIZ_FORM_DUPLICATED", entityType: "Ujian", entityId: ujian.id, metadata: { sourceId: ujianId } } });
    return ujian;
  });

  return { item };
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

    if (["ONLINE_VIA_WALI", "BOTH", "ONLINE_VIA_SISWA"].includes(ujian.deliveryMode)) {
      const students = await prisma.kelasSiswa.findMany({ where: { kelasId: ujian.kelasId, status: "ACTIVE" }, select: { siswaId: true } });
      const siswaIds = students.map((student) => student.siswaId);
      if (["ONLINE_VIA_WALI", "BOTH"].includes(ujian.deliveryMode)) {
        await notifyWaliForStudents({
          siswaIds,
          template: "online-exam-published",
          subject: `Tugas baru: ${ujian.title}`,
          body: `Ujian online ${ujian.title} sudah tersedia untuk dikerjakan melalui menu Tugas Anak.`,
          metadata: { ujianId: ujian.id },
        });
      }
      if (["ONLINE_VIA_SISWA", "BOTH"].includes(ujian.deliveryMode)) {
        await notifySiswaForStudents({
          siswaIds,
          template: "online-exam-published",
          subject: `Ujian baru: ${ujian.title}`,
          body: `Ujian online ${ujian.title} sudah tersedia untuk dikerjakan melalui menu Ujian di portal siswa.`,
          metadata: { ujianId: ujian.id },
        });
      }
    }
  }

  return { item: { id: ujian.id, status: "PUBLISHED" as const } };
}
