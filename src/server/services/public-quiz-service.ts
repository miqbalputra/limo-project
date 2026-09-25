import "server-only";
import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { ConflictError, NotFoundError, ValidationError } from "@/server/errors/application-error";
import { assertRateLimit } from "@/server/security/rate-limit";
import { storeQuizSubmissionFile } from "@/server/providers/storage/local-storage";
import { createNotificationIfMissing } from "@/server/services/notification-service";
import { publicQuizDraftSchema, startPublicQuizSchema, submitPublicQuizSchema } from "@/server/validation/exam";
import {
  answerValidationProblem,
  findMissingRequiredAnswers,
  gradeObjectiveAnswer,
  isWithinSubmitGrace,
  parseBranchRules,
  readFileUploadConfig,
  resolveFeedbackText,
  type AnswerValidation,
  type GradableAnswer,
  type GradableQuestion,
} from "@/server/services/quiz-grading";

type QuestionOrder = {
  questions: string[];
  options: Record<string, string[]>;
};

function sortedLabels(values: string[] | undefined) {
  return [...(values || [])].map((value) => value.toUpperCase()).sort();
}

function hashIp(ip: string | null | undefined) {
  if (!ip) return null;
  return createHash("sha256").update(`quiz:${ip}`).digest("hex");
}

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
}

function assertQuizWindow(ujian: { availableFrom: Date | null; availableUntil: Date | null }) {
  const now = new Date();
  if (ujian.availableFrom && ujian.availableFrom > now) {
    throw new ConflictError("Kuis belum dibuka. Coba lagi sesuai jadwal.");
  }
  if (ujian.availableUntil && ujian.availableUntil < now) {
    throw new ConflictError("Kuis sudah ditutup.");
  }
}

function sanitizeQuestion(question: {
  id: string;
  weight: Prisma.Decimal;
  required: boolean;
  sectionIndex: number;
  branchRules: unknown;
  bankSoal: {
    type: string;
    question: string;
    helpText: string | null;
    stimulusText: string | null;
    mediaUrl: string | null;
    structuredPayload: unknown;
    fileUploadConfig: unknown;
    language: string | null;
    direction: string | null;
    allowOther: boolean;
    options: { label: string; content: string; mediaUrl: string | null }[];
  };
}, optionOrder: string[] | undefined) {
  const options = optionOrder
    ? optionOrder
        .map((label) => question.bankSoal.options.find((option) => option.label === label))
        .filter((option): option is { label: string; content: string; mediaUrl: string | null } => Boolean(option))
    : question.bankSoal.options;

  const payload = (question.bankSoal.structuredPayload ?? null) as
    | { min?: number; max?: number; minLabel?: string; maxLabel?: string; kind?: string; rows?: string[]; multiple?: boolean; validation?: { type?: string; min?: number | null; max?: number | null; pattern?: string | null; message?: string | null } }
    | null;
  const upload = readFileUploadConfig(question.bankSoal.fileUploadConfig);

  return {
    id: question.id,
    weight: Number(question.weight),
    required: question.required,
    sectionIndex: question.sectionIndex,
    branchRules: question.branchRules,
    type: question.bankSoal.type,
    question: question.bankSoal.question,
    helpText: question.bankSoal.helpText,
    stimulusText: question.bankSoal.stimulusText,
    mediaUrl: question.bankSoal.mediaUrl,
    language: question.bankSoal.language,
    direction: question.bankSoal.direction,
    allowOther: question.bankSoal.allowOther,
    scaleMin: payload?.min ?? null,
    scaleMax: payload?.max ?? null,
    scaleMinLabel: payload?.minLabel ?? null,
    scaleMaxLabel: payload?.maxLabel ?? null,
    kind: payload?.kind ?? null,
    gridRows: Array.isArray(payload?.rows) ? payload!.rows : [],
    gridMultiple: Boolean(payload?.multiple),
    uploadAllowedTypes: question.bankSoal.type === "FILE_UPLOAD" ? upload.allowedTypes : [],
    uploadMaxSizeMb: question.bankSoal.type === "FILE_UPLOAD" ? upload.maxSizeMb : 0,
    validation: payload?.validation
      ? { type: payload.validation.type ?? "NONE", min: payload.validation.min ?? null, max: payload.validation.max ?? null, pattern: payload.validation.pattern ?? null, message: payload.validation.message ?? null }
      : null,
    options: options.map((option) => ({ label: option.label, content: option.content, mediaUrl: option.mediaUrl })),
  };
}

const quizInclude = {
  sections: { orderBy: { order: "asc" as const }, select: { id: true, order: true, title: true, description: true } },
  questions: {
    orderBy: { order: "asc" as const },
    include: {
      bankSoal: {
        include: { options: { orderBy: { order: "asc" as const }, select: { label: true, content: true, mediaUrl: true, isCorrect: true } } },
      },
    },
  },
};

export async function getPublicQuizIntro(token: string) {
  const ujian = await prisma.ujian.findUnique({
    where: { shareToken: token },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      mode: true,
      durationMinutes: true,
      maxAttempts: true,
      passingScore: true,
      collectRespondentName: true,
      collectRespondentEmail: true,
      showScoreImmediately: true,
      showAnswersAfterSubmit: true,
      shuffleQuestions: true,
      themeColor: true,
      headerImageUrl: true,
      confirmationMessage: true,
      availableFrom: true,
      availableUntil: true,
      kelas: { select: { name: true, program: { select: { name: true } } } },
      _count: { select: { questions: true, responses: true } },
    },
  });

  if (!ujian || ujian.status !== "PUBLISHED") {
    throw new NotFoundError("Kuis tidak ditemukan atau belum dibuka");
  }

  assertQuizWindow(ujian);

  return {
    quiz: {
      title: ujian.title,
      description: ujian.description,
      mode: ujian.mode,
      durationMinutes: ujian.durationMinutes,
      questionCount: ujian._count.questions,
      passingScore: ujian.passingScore,
      collectRespondentName: ujian.collectRespondentName,
      collectRespondentEmail: ujian.collectRespondentEmail,
      showScoreImmediately: ujian.showScoreImmediately,
      showAnswersAfterSubmit: ujian.showAnswersAfterSubmit,
      shuffleQuestions: ujian.shuffleQuestions,
      themeColor: ujian.themeColor,
      headerImageUrl: ujian.headerImageUrl,
      confirmationMessage: ujian.confirmationMessage,
      programName: ujian.kelas.program.name,
      className: ujian.kelas.name,
    },
  };
}

export async function startPublicQuizResponse(token: string, input: unknown, context: { ipAddress?: string | null }) {
  assertRateLimit({
    key: `quiz-start:${context.ipAddress || "unknown"}`,
    limit: 30,
    windowMs: 60 * 60 * 1000,
    message: "Terlalu banyak percobaan membuka kuis. Coba lagi nanti",
  });

  const parsed = startPublicQuizSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError("Nama responden belum valid", parsed.error.flatten().fieldErrors);
  }

  const ujian = await prisma.ujian.findUnique({
    where: { shareToken: token },
    select: {
      id: true,
      status: true,
      durationMinutes: true,
      maxAttempts: true,
      shuffleQuestions: true,
      shuffleOptions: true,
      collectRespondentName: true,
      collectRespondentEmail: true,
      oneResponsePerEmail: true,
      availableFrom: true,
      availableUntil: true,
      questions: { orderBy: { order: "asc" }, select: { id: true, bankSoal: { select: { shuffleOptions: true, options: { select: { label: true } } } } } },
    },
  });

  if (!ujian || ujian.status !== "PUBLISHED") {
    throw new NotFoundError("Kuis tidak ditemukan atau belum dibuka");
  }

  assertQuizWindow(ujian);

  if (ujian.questions.length === 0) {
    throw new ConflictError("Kuis belum memiliki soal");
  }

  const baseQuestionIds = ujian.questions.map((question) => question.id);
  const orderedQuestionIds = ujian.shuffleQuestions ? shuffle(baseQuestionIds) : baseQuestionIds;
  const optionOrder: Record<string, string[]> = {};
  for (const question of ujian.questions) {
    if (ujian.shuffleOptions || question.bankSoal.shuffleOptions) {
      optionOrder[question.id] = shuffle(question.bankSoal.options.map((option) => option.label));
    }
  }

  const questionOrder: QuestionOrder = { questions: orderedQuestionIds, options: optionOrder };
  const respondentName = ujian.collectRespondentName ? parsed.data.respondentName : parsed.data.respondentName || "Responden";
  const respondentEmail = (parsed.data.respondentEmail || "").trim().toLowerCase() || null;
  const ipHash = hashIp(context.ipAddress);

  if (ujian.collectRespondentEmail && !respondentEmail) {
    throw new ValidationError("Email responden wajib diisi untuk kuis ini");
  }

  if (ipHash) {
    const usedAttempts = await prisma.quizResponse.count({ where: { ujianId: ujian.id, ipHash } });
    if (usedAttempts >= ujian.maxAttempts) {
      throw new ConflictError("Batas pengerjaan tautan ini sudah tercapai.");
    }
  }

  if (respondentEmail && ujian.oneResponsePerEmail) {
    const existing = await prisma.quizResponse.count({ where: { ujianId: ujian.id, respondentEmail } });
    if (existing > 0) {
      throw new ConflictError("Email ini sudah pernah mengirim respons untuk kuis ini.");
    }
  }

  const response = await prisma.quizResponse.create({
    data: {
      ujianId: ujian.id,
      shareToken: token,
      respondentName,
      respondentEmail,
      status: "IN_PROGRESS",
      expiresAt: new Date(Date.now() + ujian.durationMinutes * 60 * 1000),
      questionOrder: questionOrder as Prisma.InputJsonValue,
      ipHash,
    },
    select: { id: true, expiresAt: true },
  });

  return { responseId: response.id, expiresAt: response.expiresAt };
}

async function loadResponseContext(responseId: string) {
  const response = await prisma.quizResponse.findUnique({
    where: { id: responseId },
    include: { ujian: { include: quizInclude } },
  });

  if (!response) {
    throw new NotFoundError("Respons kuis tidak ditemukan");
  }

  return response;
}

export async function getPublicQuizResponseContext(token: string, responseId: string) {
  const response = await loadResponseContext(responseId);

  if (response.shareToken !== token) {
    throw new NotFoundError("Respons kuis tidak ditemukan");
  }

  let status = response.status;
  if (status === "IN_PROGRESS" && response.expiresAt && response.expiresAt <= new Date()) {
    await prisma.quizResponse.update({ where: { id: response.id }, data: { status: "EXPIRED" } });
    status = "EXPIRED";
  }

  const order = (response.questionOrder as QuestionOrder | null) ?? { questions: response.ujian.questions.map((question) => question.id), options: {} };
  const sectionIndexById = new Map(response.ujian.sections.map((section, index) => [section.id, index]));
  const questionMap = new Map(response.ujian.questions.map((question) => [question.id, question]));
  const questions = order.questions
    .map((id) => questionMap.get(id))
    .filter((question): question is NonNullable<typeof question> => Boolean(question))
    .map((question) => {
      const branchRules = Array.isArray(question.branchRules)
        ? (question.branchRules as Array<{ label?: unknown; goToSectionIndex?: unknown }>)
            .filter((rule) => typeof rule.label === "string" && (rule.goToSectionIndex === null || typeof rule.goToSectionIndex === "number"))
            .map((rule) => ({ label: rule.label as string, goToSectionIndex: (rule.goToSectionIndex as number | null) ?? null }))
        : [];

      return sanitizeQuestion(
        {
          ...question,
          sectionIndex: question.sectionId ? (sectionIndexById.get(question.sectionId) ?? 0) : 0,
          branchRules,
        },
        order.options[question.id],
      );
    });

  const sections = response.ujian.sections.length > 0
    ? response.ujian.sections.map((section, index) => ({ index, title: section.title, description: section.description }))
    : [{ index: 0, title: "", description: null }];

  return {
    response: {
      id: response.id,
      status,
      expiresAt: response.expiresAt,
      draftAnswers: response.draftAnswers,
      draftSavedAt: response.draftSavedAt,
      respondentName: response.respondentName,
    },
    quiz: {
      title: response.ujian.title,
      description: response.ujian.description,
      mode: response.ujian.mode,
      durationMinutes: response.ujian.durationMinutes,
      passingScore: response.ujian.passingScore,
      showScoreImmediately: response.ujian.showScoreImmediately,
      showAnswersAfterSubmit: response.ujian.showAnswersAfterSubmit,
      themeColor: response.ujian.themeColor,
      headerImageUrl: response.ujian.headerImageUrl,
      confirmationMessage: response.ujian.confirmationMessage,
      presentationMode: response.ujian.presentationMode,
      language: null as string | null,
    },
    sections,
    questions,
  };
}

export async function savePublicQuizDraft(token: string, responseId: string, input: unknown) {
  const parsed = publicQuizDraftSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError("Draf jawaban belum valid", parsed.error.flatten().fieldErrors);
  }

  const response = await loadResponseContext(responseId);
  if (response.shareToken !== token) {
    throw new NotFoundError("Respons kuis tidak ditemukan");
  }
  if (response.status !== "IN_PROGRESS") {
    throw new ConflictError("Kuis sudah tidak aktif");
  }
  if (response.expiresAt && response.expiresAt <= new Date()) {
    await prisma.quizResponse.update({ where: { id: response.id }, data: { status: "EXPIRED" } });
    throw new ConflictError("Waktu pengerjaan sudah habis");
  }

  const questionIds = new Set(response.ujian.questions.map((question) => question.id));
  const answerIds = parsed.data.answers.map((answer) => answer.ujianSoalId);
  if (new Set(answerIds).size !== answerIds.length || answerIds.some((id) => !questionIds.has(id))) {
    throw new ValidationError("Draf berisi soal yang tidak sesuai dengan kuis");
  }

  const draftSavedAt = new Date();
  await prisma.quizResponse.update({ where: { id: response.id }, data: { draftAnswers: parsed.data.answers as Prisma.InputJsonValue, draftSavedAt } });

  return { draftSavedAt };
}

export async function submitPublicQuizResponse(token: string, responseId: string, input: unknown) {
  const parsed = submitPublicQuizSchema.safeParse(input);
  if (!parsed.success) {
    throw new ValidationError("Jawaban kuis belum valid", parsed.error.flatten().fieldErrors);
  }

  const response = await loadResponseContext(responseId);
  if (response.shareToken !== token) {
    throw new NotFoundError("Respons kuis tidak ditemukan");
  }
  if (response.status !== "IN_PROGRESS" && response.status !== "EXPIRED") {
    throw new ConflictError("Kuis sudah dikumpulkan");
  }

  const submittedAt = new Date();
  if (!isWithinSubmitGrace(response.expiresAt, submittedAt)) {
    await prisma.quizResponse.update({ where: { id: response.id }, data: { status: "EXPIRED" } });
    throw new ConflictError("Waktu pengerjaan sudah habis");
  }

  const submittedWithinWindow = !response.expiresAt || response.expiresAt >= submittedAt;

  const answersByQuestion = new Map(parsed.data.answers.map((answer) => [answer.ujianSoalId, answer]));
  const questionIds = new Set(response.ujian.questions.map((question) => question.id));
  for (const answer of parsed.data.answers) {
    if (!questionIds.has(answer.ujianSoalId)) {
      throw new ValidationError("Ada jawaban untuk soal yang bukan bagian dari kuis ini");
    }
  }

  if (submittedWithinWindow) {
    const sectionIndexById = new Map(response.ujian.sections.map((section, index) => [section.id, index]));
    const questions: GradableQuestion[] = response.ujian.questions.map((question) => ({
      id: question.id,
      required: question.required,
      type: question.bankSoal.type,
      sectionIndex: question.sectionId ? (sectionIndexById.get(question.sectionId) ?? 0) : 0,
      branchRules: parseBranchRules(question.branchRules),
    }));
    const missing = findMissingRequiredAnswers({
      questions,
      answers: parsed.data.answers,
      sectionCount: response.ujian.sections.length > 0 ? response.ujian.sections.length : 1,
    });
    if (missing.length > 0) {
      throw new ValidationError(`Masih ada ${missing.length} soal wajib yang belum diisi`);
    }
  }

  for (const question of response.ujian.questions) {
    const config = (question.bankSoal.structuredPayload as { validation?: AnswerValidation } | null)?.validation;
    const problem = answerValidationProblem({ validation: config, answer: answersByQuestion.get(question.id) });
    if (problem) {
      throw new ValidationError(`Jawaban untuk "${question.bankSoal.question.slice(0, 60)}" tidak valid: ${problem}`);
    }
  }

  let earnedWeight = 0;
  let needsReview = false;
  const totalWeight = response.ujian.questions.reduce((sum, question) => sum + Number(question.weight), 0);

  for (const question of response.ujian.questions) {
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

    if (graded.score === null) {
      needsReview = true;
    } else {
      earnedWeight += graded.score;
    }
  }

  const percent = totalWeight > 0 ? Number(((earnedWeight / totalWeight) * 100).toFixed(2)) : 0;
  const passingScore = response.ujian.passingScore;
  const passed = needsReview || passingScore === null ? null : percent >= passingScore;

  await prisma.quizResponse.update({
    where: { id: response.id },
    data: {
      status: needsReview ? "NEEDS_REVIEW" : "SUBMITTED",
      submittedAt: new Date(),
      finalAnswers: parsed.data.answers as Prisma.InputJsonValue,
      score: percent,
      maxScore: 100,
      passed,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "QUIZ_RESPONSE_SUBMITTED",
      entityType: "QuizResponse",
      entityId: response.id,
      metadata: { ujianId: response.ujianId, score: percent, needsReview },
    },
  });

  if (response.ujian.notifyGuruOnResponse || (response.ujian.sendCopyToRespondent && response.respondentEmail)) {
    const summary = `${response.respondentName || "Responden"} mengirim respons untuk "${response.ujian.title}".`;

    if (response.ujian.notifyGuruOnResponse && response.ujian.createdById) {
      const guru = await prisma.user.findUnique({ where: { id: response.ujian.createdById }, select: { email: true } });
      if (guru?.email) {
        await createNotificationIfMissing({
          channel: "in_app",
          template: "quiz-response-received",
          recipient: guru.email,
          subject: "Respons kuis baru",
          body: summary,
          dedupeKey: `quiz-response-received:${response.id}`,
          metadata: { ujianId: response.ujianId, responseId: response.id },
        });
      }
    }

    if (response.ujian.sendCopyToRespondent && response.respondentEmail) {
      await createNotificationIfMissing({
        channel: "email",
        template: "quiz-response-copy",
        recipient: response.respondentEmail,
        subject: `Salinan jawaban: ${response.ujian.title}`,
        body: `${summary}\n\nTerima kasih telah mengerjakan.`,
        dedupeKey: `quiz-response-copy:${response.id}`,
        metadata: { ujianId: response.ujianId, responseId: response.id },
      });
    }
  }

  return {
    result: {
      score: percent,
      passed,
      needsReview,
      showScoreImmediately: response.ujian.showScoreImmediately,
      passingScore,
    },
  };
}

export async function uploadPublicQuizFile(token: string, responseId: string, file: File | null, ujianSoalId?: string | null) {
  if (!file) {
    throw new ValidationError("File jawaban wajib dipilih");
  }

  const response = await loadResponseContext(responseId);
  if (response.shareToken !== token) {
    throw new NotFoundError("Respons kuis tidak ditemukan");
  }
  if (response.status !== "IN_PROGRESS") {
    throw new ConflictError("Kuis sudah tidak aktif");
  }
  if (response.expiresAt && response.expiresAt < new Date()) {
    await prisma.quizResponse.update({ where: { id: response.id }, data: { status: "EXPIRED" } });
    throw new ConflictError("Waktu pengerjaan sudah habis");
  }

  assertRateLimit({ key: `quiz-upload:${response.id}`, limit: 60, windowMs: 60 * 60 * 1000, message: "Terlalu banyak unggahan. Coba lagi nanti." });

  const question = ujianSoalId ? response.ujian.questions.find((item) => item.id === ujianSoalId) : undefined;
  if (ujianSoalId && !question) {
    throw new ValidationError("Soal unggahan tidak ditemukan pada kuis ini");
  }

  const stored = await storeQuizSubmissionFile(file, "quiz-submission", readFileUploadConfig(question?.bankSoal.fileUploadConfig));
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

export async function getPublicQuizResult(token: string, responseId: string) {
  const response = await loadResponseContext(responseId);
  if (response.shareToken !== token) {
    throw new NotFoundError("Respons kuis tidak ditemukan");
  }

  if (response.status === "IN_PROGRESS") {
    throw new ConflictError("Kuis belum dikumpulkan");
  }

  const releasePending = response.ujian.releaseMode === "AFTER_REVIEW" && !response.scoreReleasedAt;

  const feedback: Array<{
    ujianSoalId: string;
    question: string;
    correct: boolean | null;
    correctOption: string | null;
    correctAnswer: string | null;
    explanation: string | null;
    feedbackText: string | null;
  }> = [];

  if (response.ujian.showAnswersAfterSubmit && !releasePending) {
    const finalAnswers = Array.isArray(response.finalAnswers) ? (response.finalAnswers as GradableAnswer[]) : [];
    const finalByQuestion = new Map(finalAnswers.map((answer) => [answer.ujianSoalId, answer]));

    for (const question of response.ujian.questions) {
      const correctOptions = question.bankSoal.options.filter((option) => option.isCorrect);
      const correctLabels = sortedLabels(question.bankSoal.options.filter((option) => option.isCorrect).map((option) => option.label));
      const alternatives = Array.isArray(question.bankSoal.acceptedAnswers)
        ? question.bankSoal.acceptedAnswers.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
        : [];
      const graded = gradeObjectiveAnswer({
        type: question.bankSoal.type,
        weight: Number(question.weight),
        correctLabels,
        expectedAnswer: question.bankSoal.expectedAnswer ?? null,
        acceptedAnswers: question.bankSoal.acceptedAnswers,
        structuredPayload: question.bankSoal.structuredPayload,
        answer: finalByQuestion.get(question.id),
      });
      const primaryAnswer = question.bankSoal.expectedAnswer ?? (correctOptions.length > 0 ? correctOptions.map((option) => option.content).join(", ") : null);

      feedback.push({
        ujianSoalId: question.id,
        question: question.bankSoal.question,
        correct: graded.correct,
        correctOption: correctOptions[0]?.label ?? null,
        correctAnswer: [primaryAnswer, ...alternatives].filter((value): value is string => Boolean(value)).join(" / ") || null,
        explanation: question.bankSoal.explanation,
        feedbackText: resolveFeedbackText({ correct: graded.correct, feedbackCorrect: question.bankSoal.feedbackCorrect, feedbackIncorrect: question.bankSoal.feedbackIncorrect }),
      });
    }
  }

  return {
    result: {
      respondentName: response.respondentName,
      status: response.status,
      score: releasePending ? null : response.score === null ? null : Number(response.score),
      maxScore: releasePending ? null : response.maxScore === null ? null : Number(response.maxScore),
      passed: releasePending ? null : response.passed,
      passingScore: response.ujian.passingScore,
      submittedAt: response.submittedAt,
      showScoreImmediately: response.ujian.showScoreImmediately,
      showAnswersAfterSubmit: response.ujian.showAnswersAfterSubmit,
      releasePending,
      feedback,
    },
  };
}
