export interface ProjectDependency {
  id: string;
  from: string;
  to: string;
  reason: string;
}

export interface ProjectBrief {
  users: number;
  downtimeLimitMinutes: number;
  downtimeWindow: string;
  criticality: "High" | "Medium" | "Low";
  components: string[];
  dependencies: ProjectDependency[];
}

export interface ProjectDocumentSection {
  id: string;
  title: string;
  content: string;
}

export interface ProjectDocument {
  id: string;
  title: string;
  category: string;
  author: string;
  receivedAt: string;
  sections: ProjectDocumentSection[];
}

export interface ProjectDecisionReview {
  id: string;
  title: string;
  prompt: string;
  relatedDocumentIds: string[];
  evidencePoints: Array<{ id: string; label: string; anyTerms: string[] }>;
}

export interface ProjectMailMessage {
  id: string;
  receivedAt: string;
  sender: string;
  senderRole: string;
  subject: string;
  body: string;
  importance: "normal" | "high";
  relatedDocumentId: string;
}

export interface ProjectChatThread {
  id: string;
  sentAt: string;
  sender: string;
  senderRole: string;
  message: string;
  relatedDocumentId: string;
  choices: Array<{ id: string; label: string; response: string; recommended: boolean }>;
}

export interface ProjectEffortPackage {
  id: string;
  title: string;
  requiredEvents: string[];
  actualPersonHours: number;
  startsExecution?: boolean;
}

export interface ProjectMeeting {
  id: string;
  title: string;
  scheduledAt: string;
  participants: string[];
  purpose: string;
  agendaItems: Array<{
    id: string;
    title: string;
    discussion: string;
    planAlignment?: { field: "rollbackPlan"; requiredTerms: string[] };
    choices: Array<{ id: string; label: string; decision: string; recommended: boolean }>;
  }>;
}

export interface ProjectDecisionEvidence {
  id: string;
  decisionId: string;
  selectedOption: string;
  rationale: string;
  documentId: string;
  sectionId: string;
  createdAt: number;
}
