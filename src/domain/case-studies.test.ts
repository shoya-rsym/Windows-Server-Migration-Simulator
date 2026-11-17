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
        expect(question.choiceReviews).toHaveLength(question.choices.length);
        expect(question.highestFitChoices.length).toBeGreaterThan(0);
        expect(new Set(question.highestFitChoices).size).toBe(question.highestFitChoices.length);
        expect(question.highestFitChoices.every((answer) => answer >= 0 && answer < question.choices.length)).toBe(true);
        expect(question.highestFitChoices.every((answer) =>
          question.choiceReviews[answer]?.fit === Math.max(...question.choiceReviews.map(({ fit }) => fit)),
        )).toBe(true);
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
      expect(shuffledQuestion.choices[shuffledQuestion.highestFitChoices[0]])
        .toBe(sourceQuestion?.choices[sourceQuestion.highestFitChoices[0]]);
      expect(shuffledQuestion.choiceReviews[shuffledQuestion.highestFitChoices[0]]?.fit)
        .toBe(Math.max(...shuffledQuestion.choiceReviews.map(({ fit }) => fit)));
    }
    expect(shuffled[0].questions[0].highestFitChoices).not.toEqual([0]);
  });

  it("scores condition-fit points by decision dimension and marks untested dimensions", () => {
    const scores = calculateCaseJudgmentScores([
      { caseId: "dns", judgmentDimension: "riskJudge", choiceIndex: 0, fit: 3, rationaleFactors: ["利用者数"], rationale: "TTL確認" },
      { caseId: "ad", judgmentDimension: "riskJudge", choiceIndex: 2, fit: 1, rationaleFactors: [], rationale: "" },
      { caseId: "jdbc", judgmentDimension: "technicalJudge", choiceIndex: 0, fit: 2, rationaleFactors: ["DB容量・更新量"], rationale: "接続先確認" },
    ]);

    expect(scores.riskJudge).toEqual({ points: 4, maxPoints: 6, total: 2, percentage: 67 });
    expect(scores.technicalJudge).toEqual({ points: 2, maxPoints: 3, total: 1, percentage: 67 });
    const untouched = caseJudgmentDimensions.find(({ id }) => scores[id].total === 0);
    expect(untouched).toBeDefined();
    expect(untouched && scores[untouched.id].percentage).toBeNull();
  });

  it("changes the relative judgment fit when the case constraints change", () => {
    const easyDatabaseCase = caseStudyBank.find((scenario) => scenario.id === "oracle-window-easy");
    const hardDatabaseCase = caseStudyBank.find((scenario) => scenario.id === "oracle-window-hard");
    const easyQuestion = easyDatabaseCase?.questions[0];
    const hardQuestion = hardDatabaseCase?.questions[0];

    expect(easyQuestion?.choiceReviews[0].fit).toBe(3);
    expect(hardQuestion?.choiceReviews[0].fit).toBe(1);
    expect(hardQuestion?.choiceReviews[2].fit).toBe(3);
    expect(hardQuestion?.rehearsal?.result).toContain("185分");
  });

  it("attaches glossary cards and criteria based on scenario facts", () => {
    const dnsQuestion = caseStudyBank.find((scenario) => scenario.id === "dns-ttl-hard")?.questions[0];

    expect(dnsQuestion?.glossaryTerms).toContain("TTL");
    expect(dnsQuestion?.reviewBasis).toContain("利用者数: 5,000人");
    expect(dnsQuestion?.reviewBasis).toContain("停止可能時間: 15分");
    expect(dnsQuestion?.rationaleFactors).toContain("利用者数");
    expect(dnsQuestion?.rationaleFactors).toContain("停止可能時間");
  });
});
