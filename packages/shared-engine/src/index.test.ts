import { describe, expect, it } from "vitest";
import {
  completeLearningObjective,
  createSimulationState,
  type LearningObjective,
  recordSimulationEvent,
} from "./index";

describe("simulation state", () => {
  it("records events without mutating the prior state and rejects duplicate IDs", () => {
    const initial = createSimulationState("web-search");
    const recorded = recordSimulationEvent(initial, {
      id: "event-1",
      type: "requirements.confirmed",
      occurredAt: 1,
      payload: { accepted: true },
    });

    expect(initial.events).toEqual([]);
    expect(recorded.events).toHaveLength(1);
    expect(() => recordSimulationEvent(recorded, {
      id: "event-1",
      type: "requirements.confirmed",
      occurredAt: 2,
      payload: {},
    })).toThrow("イベントIDが重複しています");
  });

  it("completes each learning objective once", () => {
    const initial = createSimulationState("web-search");
    const completed = completeLearningObjective(initial, "requirements");

    expect(completeLearningObjective(completed, "requirements")).toBe(completed);
    expect(completed.completedObjectives).toEqual(["requirements"]);
    expect(() => completeLearningObjective(initial, " ")).toThrow("学習目標IDが必要です");
  });

  it("defines decision-centered objectives with a layer and proficiency", () => {
    const objective: LearningObjective = {
      id: "requirements-acceptance",
      title: "要求を受入条件へ変換する",
      layer: "case-study",
      skills: ["requirements", "decisionMaking", "communication"],
      proficiency: "participation",
      description: "条件と根拠から判断する。",
    };

    expect(objective.layer).toBe("case-study");
    expect(objective.skills).toContain("decisionMaking");
  });
});
