import { calculateAssessment } from "@se-simulator/scoring-engine";
import type { SESkill } from "@se-simulator/shared-engine";

export type CaseStudyDifficulty = "easy" | "normal" | "hard";
export type CaseJudgmentDimension =
  | "technicalJudge"
  | "operationJudge"
  | "riskJudge"
  | "communicationJudge"
  | "rollbackJudge";

export interface CaseStudyConditions {
  users: number;
  downtimeMinutes: number;
  systemType: string;
  databases?: string[];
  dependencies?: string[];
  details: string[];
}

export interface CaseChoiceReview {
  benefit: string;
  cost: string;
  fit: number;
}

export interface CaseFailureScenario {
  title: string;
  description: string;
  impact: string;
  flow: string[];
}

export interface CaseQuestion {
  id: string;
  question: string;
  choices: string[];
  highestFitChoices: number[];
  choiceReviews: CaseChoiceReview[];
  explanation: string;
  consequenceGood: string;
  consequenceBad: string;
  seniorReview: string;
  judgmentDimension: CaseJudgmentDimension;
  reviewBasis: string[];
  rationaleFactors: string[];
  glossaryTerms: string[];
  rehearsal?: { result: string; implication: string };
  failureScenario: CaseFailureScenario;
}

export interface CaseStudyScenario {
  id: string;
  title: string;
  category: string;
  difficulty: CaseStudyDifficulty;
  background: string;
  conditions: CaseStudyConditions;
  skills?: SESkill[];
  questions: CaseQuestion[];
}

export interface CaseStudyAnswer {
  caseId: string;
  judgmentDimension: CaseJudgmentDimension;
  choiceIndex: number;
  fit: number;
  rationaleFactors: string[];
  rationale: string;
}

export interface CaseJudgmentScore {
  points: number;
  maxPoints: number;
  total: number;
  percentage: number | null;
}

export type CaseJudgmentScores = Record<CaseJudgmentDimension, CaseJudgmentScore>;

export const caseJudgmentDimensions: Array<{ id: CaseJudgmentDimension; title: string }> = [
  { id: "technicalJudge", title: "技術判断" },
  { id: "operationJudge", title: "運用判断" },
  { id: "riskJudge", title: "リスク管理" },
  { id: "communicationJudge", title: "関係者調整" },
  { id: "rollbackJudge", title: "切戻し判断" },
];

export function calculateCaseJudgmentScores(answers: readonly CaseStudyAnswer[]): CaseJudgmentScores {
  const scores = calculateAssessment(answers.map((answer) => ({
    dimension: answer.judgmentDimension,
    points: answer.fit,
    maxPoints: 3,
  })));
  return Object.fromEntries(caseJudgmentDimensions.map(({ id }) => {
    const score = scores.dimensions[id];
    return [id, {
      points: score?.points ?? 0,
      maxPoints: score?.maxPoints ?? 0,
      total: answers.filter((answer) => answer.judgmentDimension === id).length,
      percentage: score?.percentage ?? null,
    }];
  })) as CaseJudgmentScores;
}
