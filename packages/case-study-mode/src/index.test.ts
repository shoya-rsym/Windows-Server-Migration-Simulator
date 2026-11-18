import { describe, expect, it } from "vitest";
import { calculateCaseJudgmentScores } from "./index";

describe("calculateCaseJudgmentScores", () => {
  it("scores only answered judgment dimensions", () => {
    const scores = calculateCaseJudgmentScores([{
      caseId: "dns-cutover",
      judgmentDimension: "riskJudge",
      choiceIndex: 1,
      fit: 2,
      rationaleFactors: ["users"],
      rationale: "利用者影響を確認したため",
    }]);

    expect(scores.riskJudge).toEqual({ points: 2, maxPoints: 3, total: 1, percentage: 67 });
    expect(scores.technicalJudge).toEqual({ points: 0, maxPoints: 0, total: 0, percentage: null });
  });
});
