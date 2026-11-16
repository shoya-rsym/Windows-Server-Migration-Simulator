import { describe, expect, it } from "vitest";
import scenarioDefinition from "../data/scenarios/windows-server-2016-to-2019.json";
import { loadScenario } from "./scenario";

describe("scenario integrity validation", () => {
  it("rejects duplicate asset identifiers", () => {
    const invalidScenario = structuredClone(scenarioDefinition);
    invalidScenario.assets.servers[1].id = invalidScenario.assets.servers[0].id;

    expect(() => loadScenario(invalidScenario)).toThrow("サーバーIDが重複しています");
  });

  it("rejects VM host links that are not reflected in the host server", () => {
    const invalidScenario = structuredClone(scenarioDefinition);
    invalidScenario.assets.vms[0].hostServerId = invalidScenario.assets.servers[1].id;

    expect(() => loadScenario(invalidScenario)).toThrow("VMをホストサーバーのvmIdsにも登録してください");
  });

  it("requires the recommended order to cover every audit check once", () => {
    const invalidScenario = structuredClone(scenarioDefinition);
    invalidScenario.recommendedOrder.pop();

    expect(() => loadScenario(invalidScenario)).toThrow("推奨作業順序には各監査項目をちょうど1回ずつ");
  });

  it("rejects an expert incident without a matching source asset", () => {
    const invalidScenario = structuredClone(scenarioDefinition);
    invalidScenario.assets.tasks = [];

    expect(() => loadScenario(invalidScenario)).toThrow("障害を再現するための移行元資産がありません: task");
  });

  it("rejects tutorial completion events without a matching operation", () => {
    const invalidScenario = structuredClone(scenarioDefinition);
    invalidScenario.tutorialSteps[0].requiredEvents = ["migration:unknown-operation"];

    expect(() => loadScenario(invalidScenario)).toThrow("チュートリアルの完了イベントが見つかりません");
  });

  it("rejects decision reviews that reference missing project documents", () => {
    const invalidScenario = structuredClone(scenarioDefinition);
    invalidScenario.decisionReviews[0].relatedDocumentIds = ["missing-document"];

    expect(() => loadScenario(invalidScenario)).toThrow("判断評価に関連する案件資料がありません");
  });

  it("loads older scenario JSON without optional project documents", () => {
    const {
      projectDocuments: _projectDocuments,
      decisionReviews: _decisionReviews,
      projectMails: _projectMails,
      projectChats: _projectChats,
      projectEffortPackages: _projectEffortPackages,
      projectMeetings: _projectMeetings,
      storyMode: _storyMode,
      ...legacyScenario
    } = structuredClone(scenarioDefinition);

    const loadedScenario = loadScenario(legacyScenario);
    expect(loadedScenario).toMatchObject({
      projectDocuments: [],
      decisionReviews: [],
      projectMails: [],
      projectChats: [],
      projectEffortPackages: [],
      projectMeetings: [],
    });
    expect(loadedScenario).not.toHaveProperty("storyMode");
  });

  it("rejects emails that reference missing project documents", () => {
    const invalidScenario = structuredClone(scenarioDefinition);
    invalidScenario.projectMails[0].relatedDocumentId = "missing-document";

    expect(() => loadScenario(invalidScenario)).toThrow("案件メールに関連する資料がありません");
  });

  it("rejects Teams conversations that reference missing project documents", () => {
    const invalidScenario = structuredClone(scenarioDefinition);
    invalidScenario.projectChats[0].relatedDocumentId = "missing-document";

    expect(() => loadScenario(invalidScenario)).toThrow("Teams会話に関連する資料がありません");
  });

  it("rejects effort packages with unknown workflow events", () => {
    const invalidScenario = structuredClone(scenarioDefinition);
    invalidScenario.projectEffortPackages[0].requiredEvents = ["migration:unknown-event"];

    expect(() => loadScenario(invalidScenario)).toThrow("工数見積の作業イベントが見つかりません");
  });

  it("rejects meeting agenda items without a recommended decision", () => {
    const invalidScenario = structuredClone(scenarioDefinition);
    invalidScenario.projectMeetings[0].agendaItems[0].choices.forEach((choice) => {
      choice.recommended = false;
    });

    expect(() => loadScenario(invalidScenario)).toThrow("会議議題に推奨判断がありません");
  });

  it("loads observation enhancements linked to the full tutorial", () => {
    const scenario = loadScenario(scenarioDefinition);

    expect(scenario.storyMode?.enabled).toBe(true);
    expect(scenario.storyMode?.steps).toHaveLength(7);
    expect(scenario.tutorialSteps).toHaveLength(26);
    expect(scenario.storyMode?.steps.map((step) => step.tutorialStepId)).toContain("reduce-dns-ttl");
    expect(scenario.storyMode?.steps[4]?.failureBranch?.diagram).toContain("旧DNSキャッシュ (TTL 86400秒)");
  });

  it("requires exactly one recommended answer in each story quiz", () => {
    const invalidScenario = structuredClone(scenarioDefinition);
    const quiz = invalidScenario.storyMode.steps.find((step) => step.tutorialStepId === "reduce-dns-ttl")?.quiz;
    if (!quiz) throw new Error("観察クイズがありません。");
    const firstChoice = quiz.choices[0];
    if (!firstChoice) throw new Error("観察クイズの選択肢がありません。");
    firstChoice.correct = true;

    expect(() => loadScenario(invalidScenario)).toThrow("観察クイズには推奨回答を1つだけ指定してください");
  });

  it("rejects observation enhancements linked to missing tutorial steps", () => {
    const invalidScenario = structuredClone(scenarioDefinition);
    const storyStep = invalidScenario.storyMode.steps[0];
    if (!storyStep) throw new Error("観察モード設定がありません。");
    storyStep.tutorialStepId = "missing-tutorial-step";

    expect(() => loadScenario(invalidScenario)).toThrow("観察モードが参照するチュートリアル手順がありません");
  });
});
