import { describe, expect, it } from "vitest";
import { getActiveStoryPhase } from "./index";

describe("getActiveStoryPhase", () => {
  const phases = [
    { id: "investigation", title: "現行調査", startStep: 1, endStep: 8 },
    { id: "planning", title: "移行計画", startStep: 9, endStep: 13 },
  ];

  it("finds the phase at both inclusive boundaries", () => {
    expect(getActiveStoryPhase(phases, 8)?.id).toBe("investigation");
    expect(getActiveStoryPhase(phases, 9)?.id).toBe("planning");
  });

  it("returns no phase when the step is outside the configured ranges", () => {
    expect(getActiveStoryPhase(phases, 14)).toBeUndefined();
  });
});
