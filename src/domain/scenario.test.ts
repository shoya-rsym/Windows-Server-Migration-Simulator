import { describe, expect, it } from "vitest";
import scenarioDefinition from "../data/scenarios/windows-server-2016-to-2019.json";
import { createObservationPreview } from "./observation";
import { loadScenario } from "./scenario";
import { runCommand } from "./simulator";

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
    expect(scenario.storyMode?.steps).toHaveLength(33);
    expect(scenario.tutorialSteps).toHaveLength(33);
    expect(scenario.storyMode?.steps.map((step) => step.tutorialStepId).sort())
      .toEqual(scenario.tutorialSteps.map((step) => step.id).sort());
    expect(scenario.storyMode?.steps.map((step) => step.tutorialStepId)).toContain("reduce-dns-ttl");
    expect(scenario.storyMode?.steps.find((step) => step.tutorialStepId === "review-project-mail")?.quiz).toBeDefined();
    expect(scenario.tutorialSteps.map((step) => step.id)).toContain("review-project-meeting");
    expect(scenario.storyMode?.steps.find((step) => step.tutorialStepId === "reduce-dns-ttl")?.failureBranch?.diagram)
      .toContain("旧DNSキャッシュ (TTL 86400秒)");
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

  it("shows imported service state in the observation preview without mutating the scenario", () => {
    const scenario = loadScenario(scenarioDefinition);
    const initialTarget = createObservationPreview(scenario, "inspect-os").environments["ap-new"];
    const preview = createObservationPreview(scenario, "migrate-services");
    const target = preview.environments["ap-new"];

    expect(initialTarget.services).toEqual([]);
    expect(target.services).toMatchObject([
      { name: "Resin", serverId: "ap-new", status: "stopped" },
    ]);
    expect(preview.environments["ap-old"].services).toMatchObject([
      { name: "Resin", serverId: "ap-old", status: "running" },
    ]);
  });

  it("keeps the Java and Oracle story output identical to the simulated commands", () => {
    const scenario = loadScenario(scenarioDefinition);
    const preview = createObservationPreview(scenario, "inspect-os");
    const javaServer = scenario.assets.servers.find((server) => server.id === "ap-old");
    const databaseServer = scenario.assets.servers.find((server) => server.id === "db-old");
    const javaAction = scenario.storyMode?.steps.find((step) => step.tutorialStepId === "inspect-java")?.autoActions[0];
    const oracleAction = scenario.storyMode?.steps.find((step) => step.tutorialStepId === "inspect-oracle-source")?.autoActions[0];
    if (!javaServer || !databaseServer || !javaAction || !oracleAction) {
      throw new Error("Observation command fixtures are missing.");
    }

    expect(javaAction.output).toEqual(runCommand(
      javaAction.command ?? "",
      javaServer,
      scenario,
      preview.environments[javaServer.id],
      preview.environments,
      preview.dns,
    ).output);
    expect(oracleAction.output).toEqual(runCommand(
      oracleAction.command ?? "",
      databaseServer,
      scenario,
      preview.environments[databaseServer.id],
      preview.environments,
      preview.dns,
    ).output);
  });

  it("shows successful direct and post-cutover connectivity in the observation preview", () => {
    const scenario = loadScenario(scenarioDefinition);
    const directPreview = createObservationPreview(scenario, "verify-connectivity");
    const target = scenario.assets.servers.find((server) => server.id === "ap-new");
    if (!target) throw new Error("Observation scenario target AP is missing.");

    const directResult = runCommand(
      "curl http://APSV02:8080/",
      target,
      scenario,
      directPreview.environments[target.id],
      directPreview.environments,
      directPreview.dns,
    );
    expect(directResult.output[0]).toBe("HTTP/1.1 200 OK");

    const cutoverPreview = createObservationPreview(scenario, "verify-post-cutover");
    expect(cutoverPreview.dns.address).toBe(target.ipAddress);
    expect(cutoverPreview.dns.cachedAddress).toBe(target.ipAddress);
  });

  it("shows completed project evidence in the observation screens", () => {
    const scenario = loadScenario(scenarioDefinition);
    const notesPreview = createObservationPreview(scenario, "record-investigation-notes");
    const teamsPreview = createObservationPreview(scenario, "review-project-teams");
    const meetingPreview = createObservationPreview(scenario, "review-project-meeting");
    const effortPreview = createObservationPreview(scenario, "review-project-effort");
    const noticePreview = createObservationPreview(scenario, "send-user-notice");

    expect(notesPreview.projectWorkspace.investigationNotes).toHaveLength(3);
    expect(teamsPreview.projectWorkspace.chatResponses).toHaveLength(2);
    expect(meetingPreview.projectWorkspace.meetingRecords).toHaveLength(scenario.projectMeetings.length);
    expect(createObservationPreview(scenario, "map-architecture").projectWorkspace.architectureEdges)
      .toHaveLength(scenario.project.dependencies.length);
    expect(effortPreview.projectWorkspace).toMatchObject({
      estimatedPersonHours: scenario.projectEffortPackages.reduce((total, item) => total + item.actualPersonHours, 0),
      estimateDocumentId: "operations-manual",
      estimateSectionId: "operations-window",
    });
    expect(noticePreview.projectWorkspace).toMatchObject({
      noticeSent: true,
      noticeLeadDays: 1,
      noticeSubject: expect.any(String),
      noticeBody: expect.stringContaining("お問い合わせ先"),
    });
  });
});
