import { describe, expect, it } from "vitest";
import { calculateAssessment } from "./index";

describe("calculateAssessment", () => {
  it("aggregates evidence by dimension and overall", () => {
    expect(calculateAssessment([
      { dimension: "planning", points: 2, maxPoints: 3 },
      { dimension: "planning", points: 3, maxPoints: 3 },
      { dimension: "testing", points: 1, maxPoints: 2 },
    ])).toEqual({
      total: { points: 6, maxPoints: 8, percentage: 75 },
      dimensions: {
        planning: { points: 5, maxPoints: 6, percentage: 83 },
        testing: { points: 1, maxPoints: 2, percentage: 50 },
      },
    });
  });

  it("rejects invalid scores and represents an empty assessment as unscored", () => {
    expect(calculateAssessment([]).total.percentage).toBeNull();
    expect(() => calculateAssessment([
      { dimension: "risk", points: 4, maxPoints: 3 },
    ])).toThrow("評価データが不正です");
  });
});
