import { z } from "zod";

const managerAppSchema = z.enum([
  "setup",
  "services",
  "tasks",
  "certificates",
  "events",
  "dns",
  "notepad",
  "resinConfig",
  "explorer",
  "database",
]);

const taskSchema = z.object({
  id: z.string(),
  name: z.string(),
  serverId: z.string(),
  schedule: z.string(),
  executable: z.string(),
  runAs: z.string(),
});

const certificateSchema = z.object({
  id: z.string(),
  serverId: z.string(),
  store: z.enum(["personal", "intermediate", "trustedRoot"]),
  subject: z.string(),
  issuer: z.string(),
  expiresOn: z.string(),
  hasPrivateKey: z.boolean(),
});

const configurationFileSchema = z.object({
  id: z.string(),
  name: z.string(),
  serverId: z.string(),
  path: z.string(),
  content: z.string(),
});

const runtimeServiceSchema = z.object({
  id: z.string(),
  name: z.string(),
  displayName: z.string(),
  serverId: z.string(),
  startupType: z.enum(["automatic", "manual"]),
  runAs: z.string(),
  status: z.enum(["running", "stopped"]),
});

const runtimeEnvironmentSchema = z.object({
  installedSoftware: z.array(z.string()).optional(),
  services: z.array(runtimeServiceSchema),
  tasks: z.array(taskSchema),
  certificates: z.array(certificateSchema),
  configurationFiles: z.array(configurationFileSchema),
  jdbcProperties: z.string().nullable(),
  databaseVersion: z.string().nullable(),
  databaseSchemas: z.array(z.string()),
  databaseRevision: z.number().optional(),
  databaseRole: z.enum(["primary", "standby", "unconfigured"]).optional(),
  dataGuardEnabled: z.boolean().optional(),
});

const projectWorkspaceSchema = z.object({
  investigationNotes: z.array(z.object({
    id: z.string(),
    title: z.string(),
    detail: z.string(),
    createdAt: z.number(),
  })),
  architectureEdges: z.array(z.object({
    id: z.string(),
    from: z.string(),
    to: z.string(),
  })),
  plannedDowntimeMinutes: z.number(),
  maintenanceWindow: z.string(),
  ttlLeadDays: z.number(),
  noticeLeadDays: z.number(),
  noticeSubject: z.string(),
  noticeBody: z.string(),
  noticeSent: z.boolean(),
  migrationStrategy: z.enum(["expdp", "rman", "dataguard"]),
  rollbackPlan: z.string(),
  cutoverDecision: z.enum(["pending", "go", "no-go", "rollback", "continue"]),
});

const cloudWorkspaceSchema = z.object({
  vpcCidr: z.string().nullable(),
  subnetCidr: z.string().nullable(),
  securityGroupCreated: z.boolean(),
  securityGroupPorts: z.array(z.number().int().min(1).max(65535)),
  instanceServerIds: z.array(z.string()),
});

const consoleEntrySchema = z.object({
  id: z.number(),
  command: z.string(),
  output: z.array(z.string()),
  isError: z.boolean().optional(),
});

const transferSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("services"), sourceServerId: z.string(), items: z.array(runtimeServiceSchema) }),
  z.object({ kind: z.literal("tasks"), sourceServerId: z.string(), items: z.array(taskSchema) }),
  z.object({ kind: z.literal("certificates"), sourceServerId: z.string(), items: z.array(certificateSchema) }),
  z.object({ kind: z.literal("configFile"), sourceServerId: z.string(), items: z.array(configurationFileSchema) }),
  z.object({ kind: z.literal("jdbc"), sourceServerId: z.string(), content: z.string() }),
  z.object({
    kind: z.literal("database"),
    sourceServerId: z.string(),
    schemas: z.array(z.string()),
    revision: z.number(),
    strategy: z.enum(["expdp", "rman", "dataguard"]).optional(),
  }),
]);

const simulationSaveSchema = z.object({
  version: z.literal(2),
  mode: z.enum(["tutorial", "beginner", "intermediate", "advanced", "expert"]),
  provider: z.enum(["onprem", "aws", "azure"]),
  paneServerIds: z.tuple([z.string(), z.string()]),
  environments: z.record(z.string(), runtimeEnvironmentSchema),
  dns: z.object({ address: z.string(), cachedAddress: z.string(), ttlSeconds: z.number() }),
  dnsDraft: z.object({ address: z.string(), cachedAddress: z.string(), ttlSeconds: z.number() }),
  history: z.record(z.string(), z.array(consoleEntrySchema)),
  inputs: z.record(z.string(), z.string()),
  activeApps: z.record(z.string(), managerAppSchema.nullable()),
  shellModes: z.record(z.string(), z.enum(["cmd", "powershell"])),
  transfer: transferSchema.nullable(),
  hypotheses: z.array(z.object({
    id: z.number(),
    text: z.string(),
    status: z.enum(["open", "confirmed", "rejected"]),
  })),
  drafts: z.record(z.string(), z.string()),
  taskRuns: z.record(z.string(), z.string()),
  completedObjectives: z.array(z.string()),
  knowledgeRecords: z.array(z.object({
    id: z.string(),
    serverId: z.string(),
    title: z.string(),
    explanation: z.string(),
  })),
  auditEvents: z.array(z.object({ name: z.string(), at: z.number() })),
  startedAt: z.number(),
  entryId: z.number(),
  projectWorkspace: projectWorkspaceSchema.optional(),
  expertIncidentId: z.string().nullable().optional(),
  cloudWorkspace: cloudWorkspaceSchema.optional(),
});

export type SimulationSave = z.infer<typeof simulationSaveSchema>;

export function parseSimulationSave(value: unknown): SimulationSave | null {
  const result = simulationSaveSchema.safeParse(value);
  return result.success ? result.data : null;
}
