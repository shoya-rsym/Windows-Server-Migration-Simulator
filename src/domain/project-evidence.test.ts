import { describe, expect, it } from "vitest";
import scenarioDefinition from "../data/scenarios/windows-server-2016-to-2019.json";
import { createInitialProjectWorkspace } from "./project";
import { evaluateProjectEvidence } from "./progress";
import { loadScenario } from "./scenario";

const scenario = loadScenario(scenarioDefinition);

describe("project document evidence review", () => {
  it("rewards a specific decision tied to a read, relevant document section", () => {
    const project = createInitialProjectWorkspace(scenario.project);
    const document = scenario.projectDocuments.find((item) => item.id === "architecture-overview");
    if (!document) throw new Error("Architecture document is missing.");
    const review = scenario.decisionReviews.find((item) => item.id === "auth-continuity");
    if (!review) throw new Error("Authentication review is missing.");

    const results = evaluateProjectEvidence(scenario, {
      ...project,
      readDocumentIds: [document.id],
      decisionEvidence: [{
        id: "auth-evidence",
        decisionId: review.id,
        selectedOption: "既存ADドメイン認証と実行アカウントを維持する",
        rationale: "基本設計書3.2にActive Directoryのドメイン認証と記載されています。移行後も認証経路とドメインコントローラーへの到達性、サービス実行アカウントを確認します。",
        documentId: document.id,
        sectionId: "architecture-auth",
        createdAt: 1,
      }],
    });

    expect(results.find((item) => item.decisionId === review.id)).toMatchObject({
      score: 100,
      citationValid: true,
      missingPoints: [],
    });
  });

  it("does not award citation points for an unrelated document", () => {
    const project = createInitialProjectWorkspace(scenario.project);
    const review = scenario.decisionReviews.find((item) => item.id === "auth-continuity");
    const unrelatedDocument = scenario.projectDocuments.find((item) => item.id === "network-change-request");
    if (!review || !unrelatedDocument) throw new Error("Evidence fixture is missing.");

    const results = evaluateProjectEvidence(scenario, {
      ...project,
      readDocumentIds: [unrelatedDocument.id],
      decisionEvidence: [{
        id: "wrong-citation",
        decisionId: review.id,
        selectedOption: "認証経路を維持する",
        rationale: "Active Directoryのドメイン認証を維持します。移行先からドメインコントローラーへ到達でき、正しい実行アカウントが利用できるかを確認します。",
        documentId: unrelatedDocument.id,
        sectionId: "network-dns",
        createdAt: 1,
      }],
    });

    expect(results.find((item) => item.decisionId === review.id)).toMatchObject({
      score: 80,
      citationValid: false,
    });
  });

  it("leaves unrecorded decisions unscored", () => {
    const results = evaluateProjectEvidence(scenario, createInitialProjectWorkspace(scenario.project));
    expect(results).toHaveLength(scenario.decisionReviews.length);
    expect(results.every((item) => item.score === 0)).toBe(true);
  });
});
