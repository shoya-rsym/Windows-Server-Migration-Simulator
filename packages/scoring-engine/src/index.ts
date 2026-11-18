export interface ScoreEvidence {
  dimension: string;
  points: number;
  maxPoints: number;
}

export interface DimensionScore {
  points: number;
  maxPoints: number;
  percentage: number | null;
}

export interface AssessmentResult {
  total: DimensionScore;
  dimensions: Record<string, DimensionScore>;
}

export function calculateAssessment(evidence: readonly ScoreEvidence[]): AssessmentResult {
  const dimensions = new Map<string, DimensionScore>();
  const total: DimensionScore = { points: 0, maxPoints: 0, percentage: null };

  for (const item of evidence) {
    if (!item.dimension.trim() || !Number.isFinite(item.points) || !Number.isFinite(item.maxPoints)
      || item.points < 0 || item.maxPoints <= 0 || item.points > item.maxPoints) {
      throw new Error(`評価データが不正です: ${item.dimension}`);
    }
    const current = dimensions.get(item.dimension) ?? { points: 0, maxPoints: 0, percentage: null };
    current.points += item.points;
    current.maxPoints += item.maxPoints;
    current.percentage = Math.round((current.points / current.maxPoints) * 100);
    dimensions.set(item.dimension, current);
    total.points += item.points;
    total.maxPoints += item.maxPoints;
  }

  total.percentage = total.maxPoints === 0 ? null : Math.round((total.points / total.maxPoints) * 100);
  return { total, dimensions: Object.fromEntries(dimensions) };
}
