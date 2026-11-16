import { describe, expect, it } from "vitest";
import {
  calculateCaseJudgmentScores,
  caseJudgmentDimensions,
  caseStudyBank,
  caseStudyDifficulties,
  getCaseStudies,
  shuffleCaseStudies,
} from "./case-studies";

describe("case study bank", () => {
  it("provides 20 cases for each difficulty across all ten categories", () => {
    expect(caseStudyBank).toHaveLength(60);
    const expectedCategories = [
      "DNS",
      "Active Directory",
      "Oracle",
      "Data Pump",
      "JDBC",
      "利用者周知",
      "Go/No-Go",
      "切戻し",
      "証明書",
      "バッチ",
    ];
    expect(new Set(caseStudyBank.map((scenario) => scenario.category)).size).toBe(10);
    expect(new Set(caseStudyBank.map((scenario) => scenario.category))).toEqual(new Set(expectedCategories));
    for (const difficulty of caseStudyDifficulties) {
      const cases = getCaseStudies(difficulty);
      expect(cases).toHaveLength(20);
      expect(new Set(cases.flatMap((scenario) => scenario.questions.map((question) => question.judgmentDimension))))
        .toEqual(new Set(caseJudgmentDimensions.map(({ id }) => id)));
    }
    expect(new Set(caseStudyBank.map((scenario) => scenario.id)).size).toBe(60);
  });

  it("keeps every answer and failure flow linked to valid case data", () => {
    for (const scenario of caseStudyBank) {
      expect(scenario.conditions.users).toBeGreaterThan(0);
      expect(scenario.conditions.downtimeMinutes).toBeGreaterThan(0);
      expect(scenario.questions.length).toBeGreaterThan(0);
      for (const question of scenario.questions) {
        expect(question.choices.length).toBeGreaterThan(1);
        expect(question.correctAnswers.length).toBeGreaterThan(0);
        expect(new Set(question.correctAnswers).size).toBe(question.correctAnswers.length);
        expect(question.correctAnswers.every((answer) => answer >= 0 && answer < question.choices.length)).toBe(true);
        expect(question.failureScenario.flow.length).toBeGreaterThan(1);
      }
    }
  });

  it("shuffles a copy without losing or duplicating cases", () => {
    const source = getCaseStudies("easy");
    const shuffled = shuffleCaseStudies(source, () => 0);

    expect(shuffled).not.toBe(source);
    expect(shuffled).toHaveLength(source.length);
    expect(shuffled.map((scenario) => scenario.id).sort()).toEqual(source.map((scenario) => scenario.id).sort());
    expect(source.map((scenario) => scenario.id)).toEqual(getCaseStudies("easy").map((scenario) => scenario.id));
    for (const scenario of shuffled) {
      const sourceQuestion = source.find((item) => item.id === scenario.id)?.questions[0];
      const shuffledQuestion = scenario.questions[0];
      expect(shuffledQuestion.choices[shuffledQuestion.correctAnswers[0]])
        .toBe(sourceQuestion?.choices[sourceQuestion.correctAnswers[0]]);
    }
    expect(shuffled[0].questions[0].correctAnswers).not.toEqual([0]);
  });

  it("scores each decision dimension independently and marks untested dimensions", () => {
    const scores = calculateCaseJudgmentScores([
      { caseId: "dns", judgmentDimension: "riskJudge", correct: true, rationale: "TTL確認" },
      { caseId: "ad", judgmentDimension: "riskJudge", correct: false, rationale: "" },
      { caseId: "jdbc", judgmentDimension: "technicalJudge", correct: true, rationale: "接続先確認" },
    ]);

    expect(scores.riskJudge).toEqual({ correct: 1, total: 2, percentage: 50 });
    expect(scores.technicalJudge).toEqual({ correct: 1, total: 1, percentage: 100 });
    const untouched = caseJudgmentDimensions.find(({ id }) => scores[id].total === 0);
    expect(untouched).toBeDefined();
    expect(untouched && scores[untouched.id].percentage).toBeNull();
  });
});
