import { describe, expect, it } from "vitest";
import scenarioDefinition from "../data/scenarios/windows-server-2016-to-2019.json";
import { createInitialProjectWorkspace } from "./project";
import {
  deriveTutorialEvents,
  getTutorialInstruction,
  getTutorialProgress,
  getTutorialSteps,
} from "./progress";
import { loadScenario } from "./scenario";
import type { TutorialStep } from "./models";

const scenario = loadScenario(scenarioDefinition);
const databaseStep: TutorialStep = {
  id: "migrate-database",
  instruction: "DBを移行してください。",
  requiredEvents: ["migrate:database"],
  explanation: "DB移行の説明。",
};

describe("tutorial workflow guidance", () => {
  it("adds cloud preparation only to cloud sessions and requires Data Guard switchover", () => {
    const onPremSteps = getTutorialSteps([databaseStep], "expdp", false);
    const cloudSteps = getTutorialSteps([databaseStep], "dataguard", true);

    expect(onPremSteps.map((step) => step.id)).toEqual(["migrate-database"]);
    expect(cloudSteps[0].id).toBe("prepare-cloud-infrastructure");
    expect(cloudSteps[1].requiredEvents).toContain("database:dataguard-switchover");
  });

  it("explains the selected database migration procedure", () => {
    expect(getTutorialInstruction(databaseStep, "expdp")).toContain("論理エクスポート");
    expect(getTutorialInstruction(databaseStep, "expdp")).toContain("expdp／impdp");
    expect(getTutorialInstruction(databaseStep, "rman")).toContain("バックアップ");
    expect(getTutorialInstruction(databaseStep, "dataguard")).toContain("dgmgrl switchover");
  });

  it("derives project-plan and Go completion only from ready state", () => {
    const initialProject = createInitialProjectWorkspace(scenario.project);
    const plannedProject = {
      ...initialProject,
      ttlLeadDays: 3,
      noticeLeadDays: 1,
      rollbackPlan: "判断期限内にDNSを旧APへ戻し、利用者へ連絡します。",
    };
    const readyItem = { id: "connectivity", title: "疎通", ready: true, detail: "" };
    const planEvents = deriveTutorialEvents([], scenario, plannedProject, [], true);
    const goEvents = deriveTutorialEvents(
      [],
      scenario,
      { ...plannedProject, cutoverDecision: "go" },
      [readyItem],
    );
    const blockedGoEvents = deriveTutorialEvents(
      [],
      scenario,
      { ...plannedProject, cutoverDecision: "go" },
      [{ ...readyItem, ready: false }],
    );
    const changedNoticeEvents = deriveTutorialEvents(
      [{ name: "project:notice-sent", at: 1 }],
      scenario,
      plannedProject,
      [],
    );

    expect(planEvents.map((event) => event.name)).toContain("tutorial:project-plan-ready");
    expect(planEvents.map((event) => event.name)).toContain("tutorial:cloud-setup-ready");
    expect(goEvents.map((event) => event.name)).toContain("tutorial:go-ready");
    expect(blockedGoEvents.map((event) => event.name)).not.toContain("tutorial:go-ready");
    expect(changedNoticeEvents.map((event) => event.name)).not.toContain("project:notice-sent");
  });

  it("requires complete investigation notes and all expected architecture dependencies", () => {
    const initialProject = createInitialProjectWorkspace(scenario.project);
    const threeNotes = Array.from({ length: 3 }, (_, index) => ({
      id: `${index}`,
      title: `調査 ${index}`,
      detail: `根拠 ${index}`,
      createdAt: index,
    }));
    const completeProject = {
      ...initialProject,
      investigationNotes: threeNotes,
      architectureEdges: scenario.project.dependencies.map(({ id, from, to }) => ({ id, from, to })),
    };
    const partialProject = {
      ...completeProject,
      investigationNotes: threeNotes.slice(0, 2),
      architectureEdges: completeProject.architectureEdges.slice(0, -1),
    };
    const completeEvents = deriveTutorialEvents([], scenario, completeProject, []);
    const partialEvents = deriveTutorialEvents([], scenario, partialProject, []);

    expect(completeEvents.map((event) => event.name)).toContain("tutorial:investigation-notes-ready");
    expect(completeEvents.map((event) => event.name)).toContain("tutorial:architecture-ready");
    expect(partialEvents.map((event) => event.name)).not.toContain("tutorial:investigation-notes-ready");
    expect(partialEvents.map((event) => event.name)).not.toContain("tutorial:architecture-ready");
  });

  it("keeps the Resin migration step incomplete until a valid configuration is saved", () => {
    const resinStep = scenario.tutorialSteps.find((step) => step.id === "migrate-resin-config");
    if (!resinStep) throw new Error("Scenario does not define the Resin migration tutorial step.");
    const copiedOnly = deriveTutorialEvents(
      [{ name: "migrate:resin-config-invalid", at: 1 }],
      scenario,
      createInitialProjectWorkspace(scenario.project),
      [],
    );
    const savedCorrectly = deriveTutorialEvents(
      [
        { name: "migrate:resin-config-invalid", at: 1 },
        { name: "migrate:resin-config-validated", at: 2 },
      ],
      scenario,
      createInitialProjectWorkspace(scenario.project),
      [],
    );
    const correctedThenChanged = deriveTutorialEvents(
      [
        { name: "migrate:resin-config-invalid", at: 1 },
        { name: "migrate:resin-config-validated", at: 2 },
        { name: "migrate:resin-config-invalid", at: 3 },
      ],
      scenario,
      createInitialProjectWorkspace(scenario.project),
      [],
    );

    expect(getTutorialProgress([resinStep], copiedOnly).activeStep).toBe(resinStep);
    expect(getTutorialProgress([resinStep], savedCorrectly).activeStep).toBeUndefined();
    expect(getTutorialProgress([resinStep], correctedThenChanged).activeStep).toBe(resinStep);
  });
});
