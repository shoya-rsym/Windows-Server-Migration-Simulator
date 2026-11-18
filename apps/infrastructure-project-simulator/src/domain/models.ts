import type {
  ProjectBrief,
  ProjectChatThread,
  ProjectDecisionEvidence,
  ProjectDecisionReview,
  ProjectDependency,
  ProjectDocument,
  ProjectEffortPackage,
  ProjectMailMessage,
  ProjectMeeting,
} from "@se-simulator/project-desk";
import type { LearningAdvisor } from "@se-simulator/advisor-engine";
import type {
  StoryAction,
  StoryFailureBranch,
  StoryFailureExample,
  StoryModeDefinition,
  StoryPhase,
  StoryQuizChoice,
  StoryReview,
  StoryReviewSection,
  StoryStep,
  TutorialStep,
} from "@se-simulator/story-mode";

export type {
  ProjectBrief,
  ProjectChatThread,
  ProjectDecisionEvidence,
  ProjectDecisionReview,
  ProjectDependency,
  ProjectDocument,
  ProjectEffortPackage,
  ProjectMailMessage,
  ProjectMeeting,
  StoryAction,
  StoryFailureBranch,
  StoryFailureExample,
  StoryModeDefinition,
  StoryPhase,
  StoryQuizChoice,
  StoryReview,
  StoryReviewSection,
  StoryStep,
  TutorialStep,
};

export type AssetRole = "application" | "database" | "dns";
export type EnvironmentStage = "source" | "target" | "infrastructure";
export type DifficultyMode = "tutorial" | "beginner" | "intermediate" | "advanced" | "expert";
export type DeploymentProvider = "onprem" | "aws" | "azure";

export interface LearningObjective {
  id: string;
  title: string;
  serverRole: AssetRole;
  commands: string[];
  tutorialInstruction: string;
  beginnerInstruction: string;
  explanation: string;
}

export interface AuditCheck {
  id: string;
  title: string;
  requiredEvents: string[];
  operationGuidance: string[];
  remediation: string;
  impact: string;
  weight: number;
}

export interface InvestigationNote {
  id: string;
  title: string;
  detail: string;
  createdAt: number;
}

export type CutoverDecision = "pending" | "go" | "no-go" | "rollback" | "continue";
export type DatabaseMigrationStrategy = "expdp" | "rman" | "dataguard";

export interface ProjectWorkspace {
  investigationNotes: InvestigationNote[];
  architectureEdges: Array<{ id: string; from: string; to: string }>;
  readDocumentIds: string[];
  readMailIds: string[];
  chatResponses: Array<{ threadId: string; choiceId: string; chosenAt: number }>;
  meetingRecords: Array<{
    meetingId: string;
    recordedAt: number;
    decisions: Array<{ agendaItemId: string; choiceId: string }>;
  }>;
  decisionEvidence: ProjectDecisionEvidence[];
  estimatedPersonHours: number | null;
  estimateRationale: string;
  estimateDocumentId: string;
  estimateSectionId: string;
  estimateConfirmedAt: number | null;
  plannedDowntimeMinutes: number;
  maintenanceWindow: string;
  ttlLeadDays: number;
  noticeLeadDays: number;
  noticeSubject: string;
  noticeBody: string;
  noticeSent: boolean;
  migrationStrategy: DatabaseMigrationStrategy;
  rollbackPlan: string;
  cutoverDecision: CutoverDecision;
}

export interface CloudWorkspace {
  vpcCidr: string | null;
  subnetCidr: string | null;
  securityGroupCreated: boolean;
  securityGroupPorts: number[];
  instanceServerIds: string[];
}

export type ManagerApp =
  | "setup"
  | "services"
  | "tasks"
  | "certificates"
  | "events"
  | "dns"
  | "notepad"
  | "resinConfig"
  | "explorer"
  | "database";

export interface VM {
  id: string;
  name: string;
  hostServerId: string;
  vcpu: number;
  memoryGb: number;
  status: "running" | "planned";
}

export interface Server {
  id: string;
  hostname: string;
  role: AssetRole;
  stage: EnvironmentStage;
  operatingSystem: string;
  ipAddress: string;
  software: string[];
  vmIds: string[];
}

export interface Database {
  id: string;
  serverId: string;
  product: string;
  version: string;
  serviceName: string;
  schemas: string[];
  listenerPort: number;
}

export interface DNS {
  id: string;
  name: string;
  recordType: "A";
  address: string;
  ttlSeconds: number;
}

export interface Service {
  id: string;
  name: string;
  displayName: string;
  serverId: string;
  startupType: "automatic" | "manual";
  runAs: string;
}

export interface RuntimeService extends Service {
  status: "running" | "stopped";
}

export interface Task {
  id: string;
  name: string;
  serverId: string;
  schedule: string;
  executable: string;
  runAs: string;
}

export interface Certificate {
  id: string;
  serverId: string;
  store: "personal" | "intermediate" | "trustedRoot";
  subject: string;
  issuer: string;
  expiresOn: string;
  hasPrivateKey: boolean;
}

export interface ConfigFile {
  id: string;
  name: string;
  serverId: string;
  path: string;
  content: string;
}

export interface CommandOutput {
  command: string;
  title: string;
  output: string[];
  insight: string;
}

export interface IncidentDefinition {
  id: string;
  title: string;
  description: string;
  cause: string;
  requiredAsset: string;
  logs: string[];
  repairAction: string;
  repairLabel: string;
}

export interface Scenario {
  id: string;
  title: string;
  description: string;
  project: ProjectBrief;
  projectDocuments: ProjectDocument[];
  decisionReviews: ProjectDecisionReview[];
  projectMails: ProjectMailMessage[];
  projectChats: ProjectChatThread[];
  projectEffortPackages: ProjectEffortPackage[];
  projectMeetings: ProjectMeeting[];
  assets: {
    servers: Server[];
    vms: VM[];
    databases: Database[];
    dns: DNS[];
    services: Service[];
    tasks: Task[];
    certificates: Certificate[];
    configurationFiles: ConfigFile[];
  };
  commands: CommandOutput[];
  incidents: IncidentDefinition[];
  learningObjectives: LearningObjective[];
  learningOrderByMode: Record<DifficultyMode, string[]>;
  tutorialSteps: TutorialStep[];
  storyMode?: StoryModeDefinition;
  auditChecks: AuditCheck[];
  recommendedOrder: string[];
  advisorContext: string;
}

export interface RuntimeEnvironment {
  installedSoftware: string[];
  services: RuntimeService[];
  tasks: Task[];
  certificates: Certificate[];
  configurationFiles: ConfigFile[];
  jdbcProperties: string | null;
  databaseVersion: string | null;
  databaseSchemas: string[];
  databaseRevision: number;
  databaseRole: "primary" | "standby" | "unconfigured";
  dataGuardEnabled: boolean;
}

export type RuntimeEnvironments = Record<string, RuntimeEnvironment>;

export type TransferPackage =
  | { kind: "services"; sourceServerId: string; items: RuntimeService[] }
  | { kind: "tasks"; sourceServerId: string; items: Task[] }
  | { kind: "certificates"; sourceServerId: string; items: Certificate[] }
  | { kind: "configFile"; sourceServerId: string; items: ConfigFile[] }
  | { kind: "jdbc"; sourceServerId: string; content: string }
  | { kind: "database"; sourceServerId: string; schemas: string[]; revision: number; strategy?: DatabaseMigrationStrategy };

export interface ConsoleEntry {
  id: number;
  command: string;
  output: string[];
  isError?: boolean;
}

export interface HypothesisNote {
  id: number;
  text: string;
  status: "open" | "confirmed" | "rejected";
}

export interface AdvisorContext {
  scenario: Scenario;
  server: Server;
  mode: DifficultyMode;
  recentCommands: ConsoleEntry[];
  hypotheses: HypothesisNote[];
}

export type Advisor = LearningAdvisor<AdvisorContext>;
