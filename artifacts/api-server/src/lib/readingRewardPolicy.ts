export type ReadingScore = {
  relevant: boolean;
  relevanceScore: number;
  specificityScore: number;
  reasoningScore: number;
  selfExpressionScore: number;
  followUpScore: number;
};

export function pointsForEvaluation(evaluation: ReadingScore): number {
  if (!evaluation.relevant || evaluation.relevanceScore === 0) return 0;
  const total = evaluation.relevanceScore + evaluation.specificityScore + evaluation.reasoningScore + evaluation.selfExpressionScore + evaluation.followUpScore;
  if (total >= 9) return 2000;
  if (total >= 7) return 1500;
  if (total >= 5) return 1000;
  return 500;
}
