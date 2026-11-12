export type AssetRole = "application" | "database" | "dns";
export type EnvironmentStage = "source" | "target" | "infrastructure";
export type DifficultyMode = "tutorial" | "beginner" | "intermediate" | "advanced";
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

export interface InvestigationNote {
  id: string;
  title: string;
  detail: string;
  createdAt: number;
}

export type CutoverDecision = "pending" | "go" | "no-go" | "rollback" | "continue";

export interface ProjectWorkspace {
  investigationNotes: InvestigationNote[];
  architectureEdges: Array<{ id: string; from: string; to: string }>;
  plannedDowntimeMinutes: number;
  maintenanceWindow: string;
  ttlLeadDays: number;
  noticeLeadDays: number;
  noticeSubject: string;
  noticeBody: string;
  noticeSent: boolean;
  migrationStrategy: "expdp" | "rman" | "dataguard";
  rollbackPlan: string;
  cutoverDecision: CutoverDecision;
}

export interface TutorialStep {
  id: string;
  instruction: string;
  requiredEvents: string[];
  explanation: string;
}

export type ManagerApp =
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
  auditChecks: AuditCheck[];
  recommendedOrder: string[];
  advisorContext: string;
}

export interface RuntimeEnvironment {
  services: RuntimeService[];
  tasks: Task[];
  certificates: Certificate[];
  configurationFiles: ConfigFile[];
  jdbcProperties: string | null;
  databaseVersion: string | null;
  databaseSchemas: string[];
}

export type RuntimeEnvironments = Record<string, RuntimeEnvironment>;

export type TransferPackage =
  | { kind: "services"; sourceServerId: string; items: RuntimeService[] }
  | { kind: "tasks"; sourceServerId: string; items: Task[] }
  | { kind: "certificates"; sourceServerId: string; items: Certificate[] }
  | { kind: "configFile"; sourceServerId: string; items: ConfigFile[] }
  | { kind: "jdbc"; sourceServerId: string; content: string }
  | { kind: "database"; sourceServerId: string; schemas: string[] };

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
  recentCommands: ConsoleEntry[];
  hypotheses: HypothesisNote[];
}

export interface Advisor {
  getAdvice(context: AdvisorContext): Promise<string>;
}
