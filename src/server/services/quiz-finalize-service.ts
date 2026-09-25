import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { gradeObjectiveAnswer, isWithinSubmitGrace, type GradableAnswer } from "@/server/services/quiz-grading";

/**
 * Jaring pengaman untuk tautan publik: respons yang ditinggalkan setelah waktu habis
 * (di luar grace window) dinilai dari draf terakhir agar jawaban tidak hilang.
 */
export async function finalizeExpiredQuizResponses(input: { limit?: number; dryRun?: boolean } = {}) {
  const now = new Date();
  const candidates = await prisma.quizResponse.findMany({
    where: { status: "IN_PROGRESS", expiresAt: { not: null } },
    orderBy: { expiresAt: "asc" },
    take: input.limit ?? 100,
    include: {
      ujian: {
        include: {
          questions: { orderBy: { order: "asc" }, include: { bankSoal: { include: { options: true } } } },
        },
      },
    },
  });

  const eligible = candidates.filter((response) => !isWithinSubmitGrace(response.expiresAt, now));
  if (input.dryRun) {
    return { scanned: candidates.length, finalized: eligible.length, dryRun: true };
  }

  let finalized = 0;

  for (const response of eligible) {
    const drafts = Array.isArray(response.draftAnswers) ? (response.draftAnswers as GradableAnswer[]) : [];
    const byQuestion = new Map(drafts.map((answer) => [answer.ujianSoalId, answer]));

    if (drafts.length === 0 || response.ujian.questions.length === 0) {
      await prisma.quizResponse.update({ where: { id: response.id }, data: { status: "EXPIRED" } });
      finalized += 1;
      continue;
    }

    let earnedWeight = 0;
    let needsReview = false;
    let totalWeight = 0;

    for (const question of response.ujian.questions) {
      totalWeight += Number(question.weight);
      const correctLabels = question.bankSoal.options.filter((option) => option.isCorrect).map((option) => option.label.toUpperCase()).sort();
      const graded = gradeObjectiveAnswer({
        type: question.bankSoal.type,
        weight: Number(question.weight),
        correctLabels,
        expectedAnswer: question.bankSoal.expectedAnswer ?? null,
        acceptedAnswers: question.bankSoal.acceptedAnswers,
        structuredPayload: question.bankSoal.structuredPayload,
        answer: byQuestion.get(question.id),
      });

      if (graded.score === null) {
        needsReview = true;
      } else {
        earnedWeight += graded.score;
      }
    }

    const percent = totalWeight > 0 ? Number(((earnedWeight / totalWeight) * 100).toFixed(2)) : 0;
    const passingScore = response.ujian.passingScore;

    await prisma.$transaction([
      prisma.quizResponse.update({
        where: { id: response.id },
        data: {
          status: needsReview ? "NEEDS_REVIEW" : "SUBMITTED",
          submittedAt: now,
          finalAnswers: drafts as unknown as Prisma.InputJsonValue,
          score: percent,
          maxScore: 100,
          passed: needsReview || passingScore === null ? null : percent >= passingScore,
        },
      }),
      prisma.auditLog.create({
        data: {
          action: "QUIZ_RESPONSE_AUTO_FINALIZED",
          entityType: "QuizResponse",
          entityId: response.id,
          metadata: { ujianId: response.ujianId, score: percent, needsReview },
        },
      }),
    ]);

    finalized += 1;
  }

  return { scanned: candidates.length, finalized, dryRun: false };
}
