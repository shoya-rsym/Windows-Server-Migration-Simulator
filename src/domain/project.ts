import type { ProjectBrief, ProjectWorkspace } from "./models";

export function createInitialProjectWorkspace(brief: ProjectBrief): ProjectWorkspace {
  return {
    investigationNotes: [],
    architectureEdges: [],
    readDocumentIds: [],
    readMailIds: [],
    chatResponses: [],
    meetingRecords: [],
    decisionEvidence: [],
    estimatedPersonHours: null,
    estimateRationale: "",
    estimateDocumentId: "",
    estimateSectionId: "",
    estimateConfirmedAt: null,
    plannedDowntimeMinutes: brief.downtimeLimitMinutes,
    maintenanceWindow: brief.downtimeWindow,
    ttlLeadDays: 0,
    noticeLeadDays: 0,
    noticeSubject: "システム停止のお知らせ",
    noticeBody: `${brief.downtimeWindow} にシステム切替を予定しています。`,
    noticeSent: false,
    migrationStrategy: "expdp",
    rollbackPlan: "",
    cutoverDecision: "pending",
  };
}
