import "server-only";
import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { ConflictError, NotFoundError, ValidationError } from "@/server/errors/application-error";
import { assertRateLimit } from "@/server/security/rate-limit";
import { publicQuizDraftSchema, startPublicQuizSchema, submitPublicQuizSchema } from "@/server/validation/exam";

const manualReviewTypes = new Set(["SPEAKING", "WRITING", "ROLEPLAY", "ESAI"]);

type QuestionOrder = {
  questions: string[];
  options: Record<string, string[]>;
};

function normalizeText(value: string | null | undefined) {
  return (value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function sortedLabels(values: string[] | undefined) {
  return [...(values || [])].map((value) => value.toUpperCase()).sort();
}

function jsonEquals(left: unknown, right: unknown) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
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
    stimulusText: string | null;
    mediaUrl: string | null;
    language: string | null;
    direction: string | null;
    allowOther: boolean;
    options: { label: string; content: string }[];
  };
}, optionOrder: string[] | undefined) {
  const options = optionOrder
    ? optionOrder
        .map((label) => question.bankSoal.options.find((option) => option.label === label))
        .filter((option): option is { label: string; content: string } => Boolean(option))
    : question.bankSoal.options;

  return {
    id: question.id,
    weight: Number(question.weight),
    required: question.required,
    sectionIndex: question.sectionIndex,
    branchRules: question.branchRules,
    type: question.bankSoal.type,
    question: question.bankSoal.question,
    stimulusText: question.bankSoal.stimulusText,
    mediaUrl: question.bankSoal.mediaUrl,
    language: question.bankSoal.language,
    direction: question.bankSoal.direction,
    allowOther: question.bankSoal.allowOther,
    options: options.map((option) => ({ label: option.label, content: option.content })),
  };
}

const quizInclude = {
  sections: { orderBy: { order: "asc" as const }, select: { id: true, order: true, title: true, description: true } },
  questions: {
    orderBy: { order: "asc" as const },
    include: {
      bankSoal: {
        include: { options: { orderBy: { order: "asc" as const }, select: { label: true, content: true, isCorrect: true } } },
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
      showScoreImmediately: true,
      showAnswersAfterSubmit: true,
      shuffleQuestions: true,
      themeColor: true,
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
      showScoreImmediately: ujian.showScoreImmediately,
      showAnswersAfterSubmit: ujian.showAnswersAfterSubmit,
      shuffleQuestions: ujian.shuffleQuestions,
      themeColor: ujian.themeColor,
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
      shuffleQuestions: true,
      shuffleOptions: true,
      collectRespondentName: true,
      availableFrom: true,
      availableUntil: true,
      questions: { orderBy: { order: "asc" }, select: { id: true, bankSoal: { select: { options: { select: { label: true } } } } } },
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
  if (ujian.shuffleOptions) {
    for (const question of ujian.questions) {
      optionOrder[question.id] = shuffle(question.bankSoal.options.map((option) => option.label));
    }
  }

  const questionOrder: QuestionOrder = { questions: orderedQuestionIds, options: optionOrder };
  const respondentName = ujian.collectRespondentName ? parsed.data.respondentName : parsed.data.respondentName || "Responden";

  const response = await prisma.quizResponse.create({
    data: {
      ujianId: ujian.id,
      shareToken: token,
      respondentName,
      status: "IN_PROGRESS",
      expiresAt: new Date(Date.now() + ujian.durationMinutes * 60 * 1000),
      questionOrder: questionOrder as Prisma.InputJsonValue,
      ipHash: hashIp(context.ipAddress),
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
  if (response.status !== "IN_PROGRESS") {
    throw new ConflictError("Kuis sudah dikumpulkan");
  }
  if (response.expiresAt && response.expiresAt < new Date()) {
    await prisma.quizResponse.update({ where: { id: response.id }, data: { status: "EXPIRED" } });
    throw new ConflictError("Waktu pengerjaan sudah habis");
  }

  const answersByQuestion = new Map(parsed.data.answers.map((answer) => [answer.ujianSoalId, answer]));
  const questionIds = new Set(response.ujian.questions.map((question) => question.id));
  for (const answer of parsed.data.answers) {
    if (!questionIds.has(answer.ujianSoalId)) {
      throw new ValidationError("Ada jawaban untuk soal yang bukan bagian dari kuis ini");
    }
  }

  let earnedWeight = 0;
  let needsReview = false;
  const totalWeight = response.ujian.questions.reduce((sum, question) => sum + Number(question.weight), 0);
  const feedback: Array<{ ujianSoalId: string; correct: boolean | null }> = [];

  for (const question of response.ujian.questions) {
    const answer = answersByQuestion.get(question.id);
    const correctOptions = sortedLabels(question.bankSoal.options.filter((option) => option.isCorrect).map((option) => option.label));
    let score = 0;

    if (question.bankSoal.type === "PILIHAN_GANDA") {
      const selected = answer?.selectedOption?.toUpperCase() || "";
      if (selected === "OTHER") {
        needsReview = true;
        feedback.push({ ujianSoalId: question.id, correct: null });
      } else {
        score = selected && correctOptions[0] === selected ? Number(question.weight) : 0;
        feedback.push({ ujianSoalId: question.id, correct: score > 0 });
      }
    } else if (question.bankSoal.type === "MULTI_SELECT") {
      const rawSelected = (answer?.selectedOptions ?? []).map((label) => label.toUpperCase());
      if (rawSelected.includes("OTHER")) {
        needsReview = true;
        feedback.push({ ujianSoalId: question.id, correct: null });
      } else {
        const selected = sortedLabels(answer?.selectedOptions);
        score = selected.length > 0 && jsonEquals(selected, correctOptions) ? Number(question.weight) : 0;
        feedback.push({ ujianSoalId: question.id, correct: score > 0 });
      }
    } else if (question.bankSoal.type === "BENAR_SALAH") {
      score = normalizeText(answer?.selectedOption) === normalizeText(question.bankSoal.expectedAnswer) ? Number(question.weight) : 0;
      feedback.push({ ujianSoalId: question.id, correct: score > 0 });
    } else if (["ISIAN_SINGKAT", "CLOZE", "GAMBAR", "LISTENING", "READING"].includes(question.bankSoal.type)) {
      score = normalizeText(answer?.shortAnswer) === normalizeText(question.bankSoal.expectedAnswer) ? Number(question.weight) : 0;
      feedback.push({ ujianSoalId: question.id, correct: score > 0 });
    } else if (["MENJODOHKAN", "URUTAN"].includes(question.bankSoal.type)) {
      const answerKey = (question.bankSoal.structuredPayload as { answerKey?: unknown } | null)?.answerKey;
      score = jsonEquals(answer?.structuredAnswer, answerKey) ? Number(question.weight) : 0;
      feedback.push({ ujianSoalId: question.id, correct: score > 0 });
    } else if (manualReviewTypes.has(question.bankSoal.type)) {
      needsReview = true;
      feedback.push({ ujianSoalId: question.id, correct: null });
    } else {
      feedback.push({ ujianSoalId: question.id, correct: null });
    }

    earnedWeight += score;
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

export async function getPublicQuizResult(token: string, responseId: string) {
  const response = await loadResponseContext(responseId);
  if (response.shareToken !== token) {
    throw new NotFoundError("Respons kuis tidak ditemukan");
  }

  if (response.status === "IN_PROGRESS") {
    throw new ConflictError("Kuis belum dikumpulkan");
  }

  const feedback: Array<{
    ujianSoalId: string;
    question: string;
    correct: boolean | null;
    correctOption: string | null;
    correctAnswer: string | null;
    explanation: string | null;
  }> = [];

  if (response.ujian.showAnswersAfterSubmit) {
    for (const question of response.ujian.questions) {
      const correctOptions = question.bankSoal.options.filter((option) => option.isCorrect);
      feedback.push({
        ujianSoalId: question.id,
        question: question.bankSoal.question,
        correct: null,
        correctOption: correctOptions[0]?.label ?? null,
        correctAnswer: question.bankSoal.expectedAnswer ?? (correctOptions.length > 0 ? correctOptions.map((option) => option.content).join(", ") : null),
        explanation: question.bankSoal.explanation,
      });
    }
  }

  return {
    result: {
      respondentName: response.respondentName,
      status: response.status,
      score: response.score === null ? null : Number(response.score),
      maxScore: response.maxScore === null ? null : Number(response.maxScore),
      passed: response.passed,
      passingScore: response.ujian.passingScore,
      submittedAt: response.submittedAt,
      showScoreImmediately: response.ujian.showScoreImmediately,
      showAnswersAfterSubmit: response.ujian.showAnswersAfterSubmit,
      feedback,
    },
  };
}
