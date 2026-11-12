export type PhaseId =
  | "investigation"
  | "architecture"
  | "build"
  | "database-migration"
  | "application-migration"
  | "cutover"
  | "incident-response";

export type AssetRole = "application" | "database" | "dns";

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
}

export interface Task {
  id: string;
  name: string;
  serverId: string;
  schedule: string;
  executable: string;
}

export interface PhaseDefinition {
  id: PhaseId;
  title: string;
  shortTitle: string;
  objective: string;
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
  phases: PhaseDefinition[];
  assets: {
    servers: Server[];
    vms: VM[];
    databases: Database[];
    dns: DNS[];
    services: Service[];
    tasks: Task[];
  };
  commands: CommandOutput[];
  incidents: IncidentDefinition[];
  advisorContext: string;
}

export interface GameState {
  currentPhase: PhaseId;
  completedPhases: PhaseId[];
  commandOutputs: string[];
  architectureAnswer: string | null;
  buildOptions: {
    operatingSystem: string;
    javaVersion: string;
    resinVersion: string;
  };
  databaseMethod: string | null;
  migratedAssets: string[];
  cutover: {
    finalSync: boolean;
    ttlMinutes: number;
    dnsSwitched: boolean;
    servicesSwitched: boolean;
  };
  activeIncident: IncidentDefinition | null;
  incidentSolved: boolean;
  incidentAttempted: boolean;
  downtimeMinutes: number;
  migrationSuccess: number;
  riskPoints: number;
  eventLog: string[];
}

export interface ScoreBreakdown {
  architecture: number;
  migration: number;
  downtime: number;
  incidentResponse: number;
  total: number;
}

export interface AdvisorContext {
  scenario: Scenario;
  state: GameState;
  score: ScoreBreakdown;
}

export interface Advisor {
  getAdvice(context: AdvisorContext): Promise<string>;
}
