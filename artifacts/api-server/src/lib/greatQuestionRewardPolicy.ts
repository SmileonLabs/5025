export type GreatQuestionScores = {
  relevant: boolean;
  curiosityScore: number;
  depthScore: number;
  originalityScore: number;
  clarityScore: number;
};

export function greatQuestionPoints(e: GreatQuestionScores) {
  if (!e.relevant) return 0;
  const total = e.curiosityScore + e.depthScore + e.originalityScore + e.clarityScore;
  if (total <= 3) return 0;
  if (total <= 5) return 500;
  if (total === 6) return 1000;
  if (total === 7) return 1500;
  return 2000;
}
