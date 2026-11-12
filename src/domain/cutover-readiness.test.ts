import { describe, expect, it } from "vitest";
import scenarioDefinition from "../data/scenarios/windows-server-2016-to-2019.json";
import { getCutoverReadiness } from "./progress";
import { loadScenario } from "./scenario";
import type { AuditEvent } from "./progress";
import type { ProjectWorkspace } from "./models";

const scenario = loadScenario(scenarioDefinition);
const scenarioModules = import.meta.glob<{ default: unknown }>("../data/scenarios/*.json", { eager: true });

function createProject(): ProjectWorkspace {
  return {
    investigationNotes: [],
    architectureEdges: [],
    plannedDowntimeMinutes: scenario.project.downtimeLimitMinutes,
    maintenanceWindow: scenario.project.downtimeWindow,
    ttlLeadDays: 0,
    noticeLeadDays: 1,
    noticeSubject: "システム停止のお知らせ",
    noticeBody: "切替作業を実施します。",
    noticeSent: true,
    migrationStrategy: "expdp",
    rollbackPlan: "判断期限内にDNSを旧APへ戻し、利用者へ連絡します。",
    cutoverDecision: "pending",
  };
}

function readinessItem(events: AuditEvent[], id: string) {
  return getCutoverReadiness(scenario, events, createProject(), false)
    .find((item) => item.id === id);
}

describe("cutover readiness", () => {
  it("accepts direct AP connectivity before DNS is cut over", () => {
    expect(readinessItem([{ name: "verify:connectivity", at: 1 }], "connectivity")?.ready).toBe(true);
  });

  it("requires connectivity verification after the latest migration change", () => {
    const events = [
      { name: "verify:connectivity", at: 1 },
      { name: "migrate:resin-settings", at: 2 },
    ];

    expect(readinessItem(events, "connectivity")?.ready).toBe(false);
    expect(readinessItem([...events, { name: "verify:connectivity", at: 3 }], "connectivity")?.ready).toBe(true);
  });

  it("starts a fresh readiness cycle after rollback", () => {
    const events = [
      { name: "verify:connectivity", at: 1 },
      { name: "project:notice-sent", at: 2 },
      { name: "dns:rollback", at: 3 },
    ];

    expect(readinessItem(events, "connectivity")?.ready).toBe(false);
    expect(readinessItem(events, "user-notice")?.ready).toBe(false);
  });
});

describe("scenario definitions", () => {
  it("validates every JSON scenario on load", () => {
    const definitions = Object.entries(scenarioModules);

    expect(definitions.length).toBeGreaterThan(0);
    for (const [path, definition] of definitions) {
      expect(() => loadScenario(definition.default), path).not.toThrow();
    }
  });
});
