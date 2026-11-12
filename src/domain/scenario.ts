import { z } from "zod";
import type { Scenario } from "./models";

const scenarioSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  project: z.object({
    users: z.number().int().positive(),
    downtimeLimitMinutes: z.number().positive(),
    downtimeWindow: z.string().min(1),
    criticality: z.enum(["High", "Medium", "Low"]),
    components: z.array(z.string().min(1)).min(1),
    dependencies: z.array(z.object({
      id: z.string().min(1),
      from: z.string().min(1),
      to: z.string().min(1),
      reason: z.string().min(1),
    })),
  }),
  assets: z.object({
    servers: z.array(z.object({
      id: z.string(),
      hostname: z.string(),
      role: z.enum(["application", "database", "dns"]),
      stage: z.enum(["source", "target", "infrastructure"]),
      operatingSystem: z.string(),
      ipAddress: z.string(),
      software: z.array(z.string()),
      vmIds: z.array(z.string()),
    })).min(1),
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
      serviceName: z.string(),
      schemas: z.array(z.string()),
      listenerPort: z.number(),
    })),
    dns: z.array(z.object({
      id: z.string(),
      name: z.string(),
      recordType: z.literal("A"),
      address: z.string(),
      ttlSeconds: z.number(),
    })).min(1),
    services: z.array(z.object({
      id: z.string(),
      name: z.string(),
      displayName: z.string(),
      serverId: z.string(),
      startupType: z.enum(["automatic", "manual"]),
      runAs: z.string(),
    })),
    tasks: z.array(z.object({
      id: z.string(),
      name: z.string(),
      serverId: z.string(),
      schedule: z.string(),
      executable: z.string(),
      runAs: z.string(),
    })),
    certificates: z.array(z.object({
      id: z.string(),
      serverId: z.string(),
      store: z.enum(["personal", "intermediate", "trustedRoot"]),
      subject: z.string(),
      issuer: z.string(),
      expiresOn: z.string(),
      hasPrivateKey: z.boolean(),
    })),
    configurationFiles: z.array(z.object({
      id: z.string(),
      name: z.string(),
      serverId: z.string(),
      path: z.string(),
      content: z.string(),
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
  learningObjectives: z.array(z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    serverRole: z.enum(["application", "database", "dns"]),
    commands: z.array(z.string().min(1)).min(1),
    tutorialInstruction: z.string(),
    beginnerInstruction: z.string(),
    explanation: z.string(),
  })),
  learningOrderByMode: z.object({
    tutorial: z.array(z.string()),
    beginner: z.array(z.string()),
    intermediate: z.array(z.string()),
    advanced: z.array(z.string()),
    expert: z.array(z.string()),
  }),
  tutorialSteps: z.array(z.object({
    id: z.string().min(1),
    instruction: z.string().min(1),
    requiredEvents: z.array(z.string().min(1)).min(1),
    explanation: z.string().min(1),
  })).min(1),
  auditChecks: z.array(z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    requiredEvents: z.array(z.string().min(1)).min(1),
    operationGuidance: z.array(z.string().min(1)),
    remediation: z.string().min(1),
    impact: z.string(),
    weight: z.number().positive(),
  })),
  recommendedOrder: z.array(z.string().min(1)),
  advisorContext: z.string(),
}).superRefine((scenario, context) => {
  const serverIds = new Set(scenario.assets.servers.map((server) => server.id));
  const assetServerIds = [
    ...scenario.assets.vms.map((asset) => asset.hostServerId),
    ...scenario.assets.databases.map((asset) => asset.serverId),
    ...scenario.assets.services.map((asset) => asset.serverId),
    ...scenario.assets.tasks.map((asset) => asset.serverId),
    ...scenario.assets.certificates.map((asset) => asset.serverId),
    ...scenario.assets.configurationFiles.map((asset) => asset.serverId),
  ];

  assetServerIds.forEach((serverId) => {
    if (!serverIds.has(serverId)) {
      context.addIssue({
        code: "custom",
        message: `関連するサーバーが見つかりません: ${serverId}`,
        path: ["assets"],
      });
    }
  });

  const auditIds = new Set(scenario.auditChecks.map((check) => check.id));
  const learningIds = new Set(scenario.learningObjectives.map((objective) => objective.id));
  const sourceApplicationId = scenario.assets.servers.find((server) =>
    server.role === "application" && server.stage === "source",
  )?.id;
  const sourceDatabaseId = scenario.assets.servers.find((server) =>
    server.role === "database" && server.stage === "source",
  )?.id;
  const dnsName = scenario.assets.dns[0]?.name.toLowerCase() ?? "";
  const expertIncidentCanBeInjected = scenario.incidents.some((incident) => {
    if (incident.requiredAsset === "service") {
      return scenario.assets.services.some((service) =>
        service.serverId === sourceApplicationId && service.name.toLowerCase().includes("resin"),
      );
    }
    if (incident.requiredAsset === "certificate") {
      return scenario.assets.certificates.some((certificate) =>
        certificate.serverId === sourceApplicationId
        && certificate.hasPrivateKey
        && certificate.subject.toLowerCase().includes(dnsName),
      );
    }
    if (incident.requiredAsset === "jdbc") {
      return Boolean(sourceApplicationId && sourceDatabaseId
        && scenario.assets.databases.some((database) => database.serverId === sourceDatabaseId));
    }
    if (incident.requiredAsset === "task") {
      return scenario.assets.tasks.some((task) => task.serverId === sourceApplicationId);
    }
    return false;
  });
  if (!expertIncidentCanBeInjected) {
    context.addIssue({
      code: "custom",
      message: "エキスパートモード用に実際のシナリオ資産へ適用できるサービス・証明書・JDBC・タスク障害を定義してください。",
      path: ["incidents"],
    });
  }
  const componentNames = new Set(scenario.project.components);
  const dependencyIds = new Set<string>();
  scenario.project.dependencies.forEach((dependency, index) => {
    if (dependencyIds.has(dependency.id)) {
      context.addIssue({
        code: "custom",
        message: `依存関係IDが重複しています: ${dependency.id}`,
        path: ["project", "dependencies", index, "id"],
      });
    }
    dependencyIds.add(dependency.id);
    if (!componentNames.has(dependency.from) || !componentNames.has(dependency.to)) {
      context.addIssue({
        code: "custom",
        message: "依存関係の接続元・接続先はcomponentsに定義してください。",
        path: ["project", "dependencies", index],
      });
    }
  });
  scenario.auditChecks.forEach((check, index) => {
    if (check.operationGuidance.length !== check.requiredEvents.length) {
      context.addIssue({
        code: "custom",
        message: "監査イベントごとに不足操作の説明を指定してください。",
        path: ["auditChecks", index, "operationGuidance"],
      });
    }
  });
  scenario.tutorialSteps.forEach((step, index) => {
    step.requiredEvents.forEach((event) => {
      if (!scenario.auditChecks.some((check) => check.requiredEvents.includes(event))
        && !["inspect:hostname:source", "verify:post-cutover"].includes(event)) {
        context.addIssue({
          code: "custom",
          message: `チュートリアルの完了イベントが見つかりません: ${event}`,
          path: ["tutorialSteps", index, "requiredEvents"],
        });
      }
    });
  });
  Object.entries(scenario.learningOrderByMode).forEach(([mode, objectiveIds]) => {
    objectiveIds.forEach((objectiveId) => {
      if (!learningIds.has(objectiveId)) {
        context.addIssue({
          code: "custom",
          message: `学習目標が見つかりません: ${objectiveId}`,
          path: ["learningOrderByMode", mode],
        });
      }
    });
  });
  scenario.recommendedOrder.forEach((checkId) => {
    if (!auditIds.has(checkId)) {
      context.addIssue({
        code: "custom",
        message: `監査項目が見つかりません: ${checkId}`,
        path: ["recommendedOrder"],
      });
    }
  });
});

export function loadScenario(input: unknown): Scenario {
  return scenarioSchema.parse(input);
}
