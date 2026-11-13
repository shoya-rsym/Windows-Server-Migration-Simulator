import { z } from "zod";
import type { Scenario } from "./models";

const tutorialOnlyEvents = new Set([
  "inspect:hostname:source",
  "inspect:route:application:source",
  "inspect:route:database:source",
  "verify:post-cutover",
  "project:notice-sent",
  "start:oracle-service",
  "tutorial:project-plan-ready",
  "tutorial:go-ready",
  "tutorial:investigation-notes-ready",
  "tutorial:architecture-ready",
]);

function isTutorialOnlyEvent(event: string, scenario: Scenario): boolean {
  if (tutorialOnlyEvents.has(event)) return true;
  if (!event.startsWith("install:middleware:")) return false;
  const serverAndSoftware = event.slice("install:middleware:".length);
  const separator = serverAndSoftware.indexOf(":");
  if (separator < 1) return false;
  const serverId = serverAndSoftware.slice(0, separator);
  const softwareName = serverAndSoftware.slice(separator + 1);
  return scenario.assets.servers.some((server) =>
    server.id === serverId
    && server.stage === "target"
    && server.software.includes(softwareName),
  );
}

function addDuplicateIssues(
  values: string[],
  context: z.RefinementCtx,
  path: (string | number)[],
  label: string,
): void {
  const seen = new Set<string>();
  values.forEach((value, index) => {
    if (seen.has(value)) {
      context.addIssue({
        code: "custom",
        message: `${label}が重複しています: ${value}`,
        path: [...path, index],
      });
    }
    seen.add(value);
  });
}

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
  const sourceApplicationId = scenario.assets.servers.find((server) =>
    server.role === "application" && server.stage === "source",
  )?.id;
  const targetApplicationId = scenario.assets.servers.find((server) =>
    server.role === "application" && server.stage === "target",
  )?.id;
  const sourceDatabaseId = scenario.assets.servers.find((server) =>
    server.role === "database" && server.stage === "source",
  )?.id;
  const targetDatabaseId = scenario.assets.servers.find((server) =>
    server.role === "database" && server.stage === "target",
  )?.id;
  const serverAddresses = new Set(scenario.assets.servers.map((server) => server.ipAddress));

  addDuplicateIssues(scenario.assets.servers.map((item) => item.id), context, ["assets", "servers"], "サーバーID");
  addDuplicateIssues(scenario.assets.vms.map((item) => item.id), context, ["assets", "vms"], "VM ID");
  addDuplicateIssues(scenario.assets.databases.map((item) => item.id), context, ["assets", "databases"], "DB ID");
  addDuplicateIssues(scenario.assets.dns.map((item) => item.id), context, ["assets", "dns"], "DNS ID");
  addDuplicateIssues(scenario.assets.dns.map((item) => item.name.toLowerCase()), context, ["assets", "dns"], "DNS名");
  addDuplicateIssues(scenario.assets.services.map((item) => item.id), context, ["assets", "services"], "サービスID");
  addDuplicateIssues(scenario.assets.tasks.map((item) => item.id), context, ["assets", "tasks"], "タスクID");
  addDuplicateIssues(scenario.assets.certificates.map((item) => item.id), context, ["assets", "certificates"], "証明書ID");
  addDuplicateIssues(scenario.assets.configurationFiles.map((item) => item.id), context, ["assets", "configurationFiles"], "設定ファイルID");
  addDuplicateIssues(scenario.project.components.map((component) => component.trim().toLowerCase()), context, ["project", "components"], "構成要素");
  addDuplicateIssues(scenario.project.dependencies.map((item) => item.id), context, ["project", "dependencies"], "依存関係ID");
  addDuplicateIssues(scenario.learningObjectives.map((item) => item.id), context, ["learningObjectives"], "学習目標ID");
  addDuplicateIssues(scenario.tutorialSteps.map((item) => item.id), context, ["tutorialSteps"], "チュートリアル手順ID");
  addDuplicateIssues(scenario.auditChecks.map((item) => item.id), context, ["auditChecks"], "監査項目ID");
  addDuplicateIssues(scenario.incidents.map((item) => item.id), context, ["incidents"], "障害ID");
  addDuplicateIssues(
    scenario.commands.map((item) => item.command.trim().toLowerCase().replace(/\s+/g, " ")),
    context,
    ["commands"],
    "コマンド",
  );

  scenario.assets.servers.forEach((server, index) => {
    server.vmIds.forEach((vmId) => {
      const vm = scenario.assets.vms.find((item) => item.id === vmId);
      if (!vm || vm.hostServerId !== server.id) {
        context.addIssue({
          code: "custom",
          message: `サーバーのVM参照が一致しません: ${vmId}`,
          path: ["assets", "servers", index, "vmIds"],
        });
      }
    });
  });
  scenario.assets.vms.forEach((vm, index) => {
    const host = scenario.assets.servers.find((server) => server.id === vm.hostServerId);
    if (host && !host.vmIds.includes(vm.id)) {
      context.addIssue({
        code: "custom",
        message: `VMをホストサーバーのvmIdsにも登録してください: ${vm.id}`,
        path: ["assets", "vms", index, "hostServerId"],
      });
    }
  });
  scenario.assets.databases.forEach((database, index) => {
    const server = scenario.assets.servers.find((item) => item.id === database.serverId);
    if (server && server.role !== "database") {
      context.addIssue({
        code: "custom",
        message: `データベースの配置先はdatabaseロールである必要があります: ${database.serverId}`,
        path: ["assets", "databases", index, "serverId"],
      });
    }
  });
  scenario.assets.dns.forEach((record, index) => {
    if (!serverAddresses.has(record.address)) {
      context.addIssue({
        code: "custom",
        message: `DNS AレコードのIPに一致するサーバーがありません: ${record.address}`,
        path: ["assets", "dns", index, "address"],
      });
    }
  });
  if (!sourceApplicationId || !targetApplicationId || !sourceDatabaseId || !targetDatabaseId) {
    context.addIssue({
      code: "custom",
      message: "現在のシミュレーターは移行元・移行先のAPサーバーとDBサーバーを必要とします。",
      path: ["assets", "servers"],
    });
  }

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
  const dnsName = scenario.assets.dns[0]?.name.toLowerCase() ?? "";
  const canInjectIncident = (incident: Scenario["incidents"][number]) => {
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
      return Boolean(sourceApplicationId && targetApplicationId && sourceDatabaseId && targetDatabaseId
        && scenario.assets.databases.some((database) => database.serverId === sourceDatabaseId)
        && scenario.assets.databases.some((database) => database.serverId === targetDatabaseId));
    }
    if (incident.requiredAsset === "task") {
      return scenario.assets.tasks.some((task) => task.serverId === sourceApplicationId);
    }
    return incident.requiredAsset === "database-data" && Boolean(sourceDatabaseId && targetDatabaseId);
  };
  const expertIncidentCanBeInjected = scenario.incidents.some((incident) =>
    ["service", "certificate", "jdbc", "task"].includes(incident.requiredAsset) && canInjectIncident(incident),
  );
  if (!expertIncidentCanBeInjected) {
    context.addIssue({
      code: "custom",
      message: "エキスパートモード用に実際のシナリオ資産へ適用できるサービス・証明書・JDBC・タスク障害を定義してください。",
      path: ["incidents"],
    });
  }
  scenario.incidents.forEach((incident, index) => {
    if (!["service", "certificate", "jdbc", "task", "database-data"].includes(incident.requiredAsset)) {
      context.addIssue({
        code: "custom",
        message: `未対応の障害資産タイプです: ${incident.requiredAsset}`,
        path: ["incidents", index, "requiredAsset"],
      });
    }
    if (["service", "certificate", "jdbc", "task"].includes(incident.requiredAsset) && !canInjectIncident(incident)) {
      context.addIssue({
        code: "custom",
        message: `障害を再現するための移行元資産がありません: ${incident.requiredAsset}`,
        path: ["incidents", index, "requiredAsset"],
      });
    }
    const expectedRepairAction = incident.requiredAsset === "database-data" ? "database" : incident.requiredAsset;
    if (incident.repairAction !== expectedRepairAction) {
      context.addIssue({
        code: "custom",
        message: `障害資産タイプと修復操作が一致しません: ${incident.repairAction}`,
        path: ["incidents", index, "repairAction"],
      });
    }
  });
  const componentNames = new Set(scenario.project.components);
  scenario.project.dependencies.forEach((dependency, index) => {
    if (!componentNames.has(dependency.from) || !componentNames.has(dependency.to)) {
      context.addIssue({
        code: "custom",
        message: "依存関係の接続元・接続先はcomponentsに定義してください。",
        path: ["project", "dependencies", index],
      });
    }
  });
  scenario.auditChecks.forEach((check, index) => {
    addDuplicateIssues(check.requiredEvents, context, ["auditChecks", index, "requiredEvents"], "監査イベント");
    if (check.operationGuidance.length !== check.requiredEvents.length) {
      context.addIssue({
        code: "custom",
        message: "監査イベントごとに不足操作の説明を指定してください。",
        path: ["auditChecks", index, "operationGuidance"],
      });
    }
  });
  scenario.tutorialSteps.forEach((step, index) => {
    addDuplicateIssues(step.requiredEvents, context, ["tutorialSteps", index, "requiredEvents"], "チュートリアル完了イベント");
    step.requiredEvents.forEach((event) => {
      if (!scenario.auditChecks.some((check) => check.requiredEvents.includes(event))
        && !isTutorialOnlyEvent(event, scenario)) {
        context.addIssue({
          code: "custom",
          message: `チュートリアルの完了イベントが見つかりません: ${event}`,
          path: ["tutorialSteps", index, "requiredEvents"],
        });
      }
    });
  });
  Object.entries(scenario.learningOrderByMode).forEach(([mode, objectiveIds]) => {
    addDuplicateIssues(objectiveIds, context, ["learningOrderByMode", mode], "学習目標順序");
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
  addDuplicateIssues(scenario.recommendedOrder, context, ["recommendedOrder"], "推奨監査項目");
  if (scenario.recommendedOrder.length !== auditIds.size
    || scenario.recommendedOrder.some((checkId) => !auditIds.has(checkId))) {
    context.addIssue({
      code: "custom",
      message: "推奨作業順序には各監査項目をちょうど1回ずつ含めてください。",
      path: ["recommendedOrder"],
    });
  }
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
