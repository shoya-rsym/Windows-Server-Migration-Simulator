import { describe, expect, it } from "vitest";
import scenarioDefinition from "../data/scenarios/windows-server-2016-to-2019.json";
import { createInitialProjectWorkspace } from "./project";
import { calculateAuditReport, evaluateProjectMeetings } from "./progress";
import { loadScenario } from "./scenario";

const scenario = loadScenario(scenarioDefinition);
const meeting = scenario.projectMeetings[0];
if (!meeting) throw new Error("Meeting fixture is missing.");

function meetingRecord(recommended: boolean) {
  return {
    meetingId: meeting.id,
    recordedAt: 1,
    decisions: meeting.agendaItems.map((agendaItem) => {
      const choice = agendaItem.choices.find((item) => item.recommended === recommended);
      if (!choice) throw new Error(`Meeting choice fixture is missing: ${agendaItem.id}`);
      return { agendaItemId: agendaItem.id, choiceId: choice.id };
    }),
  };
}

describe("project meeting minutes", () => {
  it("scores a generated record based on its agenda decisions", () => {
    const project = {
      ...createInitialProjectWorkspace(scenario.project),
      meetingRecords: [meetingRecord(true)],
      rollbackPlan: "切替後30分以内に判断し、データ不整合があればDNSを旧環境へ戻す。",
    };

    expect(evaluateProjectMeetings(scenario, project)).toMatchObject([{
      meetingId: meeting.id,
      recorded: true,
      score: 100,
      decisions: meeting.agendaItems.map((agendaItem) => ({
        agendaItemId: agendaItem.id,
        recommended: true,
        planAligned: true,
      })),
    }]);
  });

  it("flags when the recorded rollback decision is missing from the work plan", () => {
    const project = {
      ...createInitialProjectWorkspace(scenario.project),
      meetingRecords: [meetingRecord(true)],
      rollbackPlan: "問題があれば後日判断します。",
    };
    const report = calculateAuditReport(scenario, [], 0, 1, 1, project);

    expect(report.projectScores.find((item) => item.id === "meetings")?.score).toBe(50);
    expect(report.projectFindings.some((finding) => finding.id === "risky-meeting-decision")).toBe(true);
  });

  it("reports missing minutes and risky decisions in the audit report", () => {
    const project = createInitialProjectWorkspace(scenario.project);
    const missingMinutesReport = calculateAuditReport(scenario, [], 0, 1, 1, project);
    const riskyMinutesReport = calculateAuditReport(scenario, [], 0, 1, 1, {
      ...project,
      meetingRecords: [meetingRecord(false)],
    });

    expect(missingMinutesReport.projectFindings.some((finding) => finding.id === "meeting-minutes-missing")).toBe(true);
    expect(riskyMinutesReport.projectScores.find((item) => item.id === "meetings")?.score).toBe(0);
    expect(riskyMinutesReport.projectFindings.some((finding) => finding.id === "risky-meeting-decision")).toBe(true);
  });

  it("keeps scenarios without meetings compatible", () => {
    const noMeetingScenario = { ...scenario, projectMeetings: [] };
    const reviews = evaluateProjectMeetings(noMeetingScenario, createInitialProjectWorkspace(scenario.project));
    const report = calculateAuditReport(noMeetingScenario, [], 0, 1, 1);

    expect(reviews).toEqual([]);
    expect(report.projectScores.find((item) => item.id === "meetings")?.score).toBe(100);
    expect(report.projectFindings.some((finding) => finding.id === "meeting-minutes-missing")).toBe(false);
  });
});
