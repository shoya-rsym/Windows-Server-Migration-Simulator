import { describe, expect, it } from "vitest";
import scenarioDefinition from "../data/scenarios/windows-server-2016-to-2019.json";
import type { ProjectWorkspace } from "./models";
import { createInitialProjectWorkspace } from "./project";
import { evaluateEffortEstimate, type AuditEvent } from "./progress";
import { loadScenario } from "./scenario";

const scenario = loadScenario(scenarioDefinition);
const effortScenario = {
  ...scenario,
  projectEffortPackages: [{
    id: "planning",
    title: "計画",
    requiredEvents: ["task:complete"],
    actualPersonHours: 10,
  }],
};

function projectWithEstimate(confirmedAt: number, overrides: Partial<ProjectWorkspace> = {}): ProjectWorkspace {
  const project = createInitialProjectWorkspace(scenario.project);
  return {
    ...project,
    estimatedPersonHours: 10,
    estimateRationale: "調査資料に記載された対象範囲と既存構成、関係者調整、移行後の確認作業まで考慮して工数を見積もりました。",
    estimateDocumentId: "architecture-overview",
    estimateSectionId: "architecture-auth",
    estimateConfirmedAt: confirmedAt,
    readDocumentIds: ["architecture-overview"],
    ...overrides,
  };
}

describe("project effort estimate review", () => {
  it("rewards an accurate, evidenced estimate recorded before work", () => {
    const work: AuditEvent[] = [{ name: "task:complete", at: 20 }];
    const result = evaluateEffortEstimate(effortScenario, work, work, projectWithEstimate(10));

    expect(result).toMatchObject({
      estimatedPersonHours: 10,
      actualPersonHours: 10,
      variancePercent: 0,
      score: 100,
      citationValid: true,
      rationaleSpecific: true,
      recordedBeforeWork: true,
    });
  });

  it("withholds citation credit when the cited section was not read", () => {
    const work: AuditEvent[] = [{ name: "task:complete", at: 20 }];
    const result = evaluateEffortEstimate(
      effortScenario,
      work,
      work,
      projectWithEstimate(10, { readDocumentIds: [] }),
    );

    expect(result.citationValid).toBe(false);
    expect(result.score).toBe(80);
  });

  it("caps the score when an estimate is recorded after work starts", () => {
    const work: AuditEvent[] = [{ name: "task:complete", at: 10 }];
    const result = evaluateEffortEstimate(effortScenario, work, work, projectWithEstimate(11));

    expect(result.recordedBeforeWork).toBe(false);
    expect(result.score).toBe(50);
  });

  it("keeps scenarios without effort packages compatible", () => {
    const result = evaluateEffortEstimate(
      { ...scenario, projectEffortPackages: [] },
      [],
      [],
      createInitialProjectWorkspace(scenario.project),
    );

    expect(result).toMatchObject({
      estimatedPersonHours: null,
      actualPersonHours: 0,
      variancePercent: null,
      score: 100,
    });
  });
});
