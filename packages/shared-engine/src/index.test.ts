import { describe, expect, it } from "vitest";
import {
  completeLearningObjective,
  createSimulationState,
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
});
