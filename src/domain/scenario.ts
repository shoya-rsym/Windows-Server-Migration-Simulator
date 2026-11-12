import { z } from "zod";
import type { Scenario } from "./models";

const phaseIds = [
  "investigation",
  "architecture",
  "build",
  "database-migration",
  "application-migration",
  "cutover",
  "incident-response",
] as const;

const scenarioSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  phases: z.array(z.object({
    id: z.enum(phaseIds),
    title: z.string().min(1),
    shortTitle: z.string().min(1),
    objective: z.string().min(1),
  })).length(7),
  assets: z.object({
    servers: z.array(z.object({
      id: z.string(),
      hostname: z.string(),
      role: z.enum(["application", "database", "dns"]),
      operatingSystem: z.string(),
      ipAddress: z.string(),
      software: z.array(z.string()),
      vmIds: z.array(z.string()),
    })),
    vms: z.array(z.object({
      id: z.string(),
      name: z.string(),
      hostServerId: z.string(),
      vcpu: z.number(),
      memoryGb: z.number(),
      status: z.enum(["running", "planned"]),
    })),
    databases: z.array(z.object({
      id: z.string(),
      serverId: z.string(),
      product: z.string(),
      version: z.string(),
      schemas: z.array(z.string()),
      listenerPort: z.number(),
    })),
    dns: z.array(z.object({
      id: z.string(),
      name: z.string(),
      recordType: z.literal("A"),
      address: z.string(),
      ttlSeconds: z.number(),
    })),
    services: z.array(z.object({
      id: z.string(),
      name: z.string(),
      displayName: z.string(),
      serverId: z.string(),
      startupType: z.enum(["automatic", "manual"]),
    })),
    tasks: z.array(z.object({
      id: z.string(),
      name: z.string(),
      serverId: z.string(),
      schedule: z.string(),
      executable: z.string(),
    })),
  }),
  commands: z.array(z.object({
    command: z.string().min(1),
    title: z.string().min(1),
    output: z.array(z.string()),
    insight: z.string(),
  })).min(1),
  incidents: z.array(z.object({
    id: z.string().min(1),
    title: z.string(),
    description: z.string(),
    cause: z.string(),
    requiredAsset: z.string(),
    logs: z.array(z.string()),
    repairAction: z.string(),
    repairLabel: z.string(),
  })).min(1),
  advisorContext: z.string(),
}).superRefine((scenario, context) => {
  const phaseIdsInScenario = scenario.phases.map((phase) => phase.id);
  if (new Set(phaseIdsInScenario).size !== phaseIdsInScenario.length) {
    context.addIssue({ code: "custom", message: "シナリオ内のフェーズIDは重複できません。", path: ["phases"] });
  }
  for (const phaseId of phaseIds) {
    if (!phaseIdsInScenario.includes(phaseId)) {
      context.addIssue({ code: "custom", message: `必須フェーズ ${phaseId} がありません。`, path: ["phases"] });
    }
  }
});

export function loadScenario(input: unknown): Scenario {
  return scenarioSchema.parse(input);
}
