import { describe, expect, it } from "vitest";
import {
  developmentProjectDocuments,
  developmentProjectContext,
  developmentConsultations,
  developmentEvidenceGuides,
  developmentStoryPhases,
  developmentSteps,
} from "./scenario";

describe("development project scenario", () => {
  it("covers the project lifecycle with unique decisions and referenced source documents", () => {
    const documentIds = new Set(developmentProjectDocuments.map((document) => document.id));
    const stepIds = developmentSteps.map((step) => step.id);

    expect(new Set(stepIds).size).toBe(developmentSteps.length);
    expect(developmentSteps).toHaveLength(12);
    expect(new Set(developmentSteps.map((step) => step.phase))).toEqual(
      new Set(developmentStoryPhases.map((phase) => phase.id)),
    );
    for (const step of developmentSteps) {
      expect(step.documentIds.length).toBeGreaterThan(0);
      expect(step.documentIds.every((documentId) => documentIds.has(documentId))).toBe(true);
      expect(step.choices.length).toBeGreaterThanOrEqual(3);
      expect(step.choices.some((choice) => choice.score === 3)).toBe(true);
      expect(step.choices.every((choice) => choice.outcome.trim().length > 0)).toBe(true);
      expect(developmentConsultations[step.id]?.role).toBeTruthy();
      expect(developmentEvidenceGuides[step.id]?.expectedIndexes.length).toBeGreaterThan(0);
      expect(developmentEvidenceGuides[step.id]?.expectedIndexes.every(
        (index) => index >= 0 && index < step.facts.length,
      )).toBe(true);
    }
  });

  it("uses the same project constraints across its brief, context, and acceptance criteria", () => {
    expect(developmentProjectContext.constraints).toContain("通常営業を止めずにリリースする。");
    expect(developmentProjectContext.successCriteria).toContain(
      "合意した負荷条件で検索APIのp95応答時間が2秒以内。",
    );
    expect(developmentSteps.find((step) => step.id === "performance-design")?.facts).toContain(
      "120同時利用相当でp95 4.8秒",
    );
    expect(developmentSteps.find((step) => step.id === "triage-release-defect")?.facts).toContain(
      "販促商品への該当有無・販売影響は未確認",
    );
  });
});
