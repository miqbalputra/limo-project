export type RemedialScorePolicy = "LATEST" | "HIGHEST" | "AVERAGE" | "CAPPED";

function roundScore(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function applyRemedialScorePolicy(input: {
  policy: RemedialScorePolicy;
  originalScore: number | null;
  remedialScore: number | null;
  scoreCap?: number | null;
}) {
  const original = input.originalScore;
  const remedial = input.remedialScore;
  if (original === null && remedial === null) return null;
  if (input.policy === "LATEST") return remedial ?? original;
  if (input.policy === "HIGHEST") return Math.max(original ?? Number.NEGATIVE_INFINITY, remedial ?? Number.NEGATIVE_INFINITY);
  if (input.policy === "AVERAGE") {
    const scores = [original, remedial].filter((score): score is number => score !== null);
    return roundScore(scores.reduce((sum, score) => sum + score, 0) / scores.length);
  }
  if (remedial === null) return original;
  const capped = input.scoreCap === null || input.scoreCap === undefined ? remedial : Math.min(remedial, input.scoreCap);
  return original === null ? capped : Math.max(original, capped);
}
