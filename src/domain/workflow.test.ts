import { describe, expect, it } from "vitest";
import scenarioDefinition from "../data/scenarios/windows-server-2016-to-2019.json";
import { createInitialProjectWorkspace } from "./project";
import { calculateAuditReport, getCutoverReadiness, type AuditEvent } from "./progress";
import { loadScenario } from "./scenario";
import {
  createExpertRuntimeEnvironments,
  createRuntimeEnvironments,
  getEventLog,
  initialDnsRuntime,
  resinConfigTargetsEnvironment,
  runCommand,
} from "./simulator";

const scenario = loadScenario(scenarioDefinition);
const sourceApplication = scenario.assets.servers.find((server) =>
  server.role === "application" && server.stage === "source",
);
const targetApplication = scenario.assets.servers.find((server) =>
  server.role === "application" && server.stage === "target",
);
const sourceDatabase = scenario.assets.servers.find((server) =>
  server.role === "database" && server.stage === "source",
);
const targetDatabase = scenario.assets.servers.find((server) =>
  server.role === "database" && server.stage === "target",
);
if (!sourceApplication || !targetApplication || !sourceDatabase || !targetDatabase) {
  throw new Error("Scenario must define source and target AP and DB servers.");
}

describe("migration project workflows", () => {
  it.each([sourceApplication, sourceDatabase, targetApplication, targetDatabase])(
    "returns host-specific inventory and routes for $hostname",
    (server) => {
      const environments = createRuntimeEnvironments(scenario);
      const environment = environments[server.id];
      if (!environment) throw new Error(`Runtime environment is missing for ${server.hostname}.`);
      const dns = initialDnsRuntime(scenario.assets.dns[0]);
      const output = (command: string) => runCommand(
        command,
        server,
        scenario,
        environment,
        environments,
        dns,
      ).output.join("\n");
      const network = server.ipAddress.slice(0, server.ipAddress.lastIndexOf("."));

      expect(output("hostname")).toBe(server.hostname);
      expect(output("systeminfo")).toContain(server.hostname);
      expect(output("ipconfig /all")).toContain(server.ipAddress);
      expect(output("route print")).toContain(`${network}.1`);
      expect(output("route print")).toContain(server.ipAddress);
    },
  );

  it("accepts resin.conf migration only when both target endpoints are correct", () => {
    const sourceConfig = scenario.assets.configurationFiles.find((file) =>
      file.serverId === sourceApplication.id && file.name === "resin.conf",
    );
    const targetDatabaseInfo = scenario.assets.databases.find((database) =>
      database.serverId === targetDatabase.id,
    );
    if (!sourceConfig || !targetDatabaseInfo) throw new Error("Scenario Resin or target database settings are missing.");
    const targetContent = sourceConfig.content
      .replaceAll(sourceApplication.ipAddress, targetApplication.ipAddress)
      .replaceAll(sourceDatabase.hostname, targetDatabase.hostname);

    expect(resinConfigTargetsEnvironment(targetContent, targetApplication, targetDatabase, targetDatabaseInfo)).toBe(true);
    expect(resinConfigTargetsEnvironment(sourceConfig.content, targetApplication, targetDatabase, targetDatabaseInfo)).toBe(false);
    expect(resinConfigTargetsEnvironment(
      targetContent.replace(targetApplication.ipAddress, sourceApplication.ipAddress),
      targetApplication,
      targetDatabase,
      targetDatabaseInfo,
    )).toBe(false);
    expect(resinConfigTargetsEnvironment(
      targetContent.replace(`${targetDatabase.hostname}:1521:ORCL`, `${targetDatabase.hostname}:1522:ORCL`),
      targetApplication,
      targetDatabase,
      targetDatabaseInfo,
    )).toBe(false);
  });

  it("does not pass the Resin migration audit on import or after a later invalid save", () => {
    const project = createInitialProjectWorkspace(scenario.project);
    const auditIsComplete = (events: AuditEvent[]) => calculateAuditReport(
      scenario,
      events,
      0,
      0,
      1_000,
      project,
    ).checks.find((item) => item.check.id === "migrate-resin-config")?.complete;

    expect(auditIsComplete([{ name: "migrate:resin-config-invalid", at: 1 }])).toBe(false);
    expect(auditIsComplete([{ name: "migrate:resin-config", at: 1 }])).toBe(false);
    expect(auditIsComplete([
      { name: "migrate:resin-config-invalid", at: 1 },
      { name: "migrate:resin-config-validated", at: 2 },
    ])).toBe(true);
    expect(auditIsComplete([
      { name: "migrate:resin-config-invalid", at: 1 },
      { name: "migrate:resin-config-validated", at: 2 },
      { name: "migrate:resin-config-invalid", at: 3 },
    ])).toBe(false);
  });

  it("detects and resolves an expert batch incident in the simulated event log", () => {
    const environments = createExpertRuntimeEnvironments(scenario, "batch-task");
    const targetEnvironment = environments[targetApplication.id];
    if (!targetEnvironment) throw new Error("Target AP runtime environment was not created.");
    const dns = {
      ...initialDnsRuntime(scenario.assets.dns[0]),
      address: targetApplication.ipAddress,
      cachedAddress: targetApplication.ipAddress,
    };
    const initialIssues = getEventLog(targetApplication, scenario, targetEnvironment, environments, dns);

    expect(initialIssues.some((issue) => issue.source === "TaskScheduler")).toBe(true);

    const sourceTasks = environments[sourceApplication.id]?.tasks ?? [];
    const repairedEnvironment = {
      ...targetEnvironment,
      tasks: sourceTasks.map((task) => ({ ...task, serverId: targetApplication.id })),
    };
    const repairedEnvironments = { ...environments, [targetApplication.id]: repairedEnvironment };

    expect(getEventLog(targetApplication, scenario, repairedEnvironment, repairedEnvironments, dns)).toHaveLength(0);
  });

  it.each([
    { strategy: "expdp" as const, sourceCommand: "expdp", targetCommand: "impdp" },
    { strategy: "rman" as const, sourceCommand: "rman backup", targetCommand: "rman restore" },
    { strategy: "dataguard" as const, sourceCommand: "dgmgrl prepare", targetCommand: "dgmgrl start standby" },
  ])("executes the $strategy database preparation on the correct hosts", ({ strategy, sourceCommand, targetCommand }) => {
    const environments = createRuntimeEnvironments(scenario);
    const sourceEnvironment = environments[sourceDatabase.id];
    const initialTargetEnvironment = environments[targetDatabase.id];
    if (!sourceEnvironment || !initialTargetEnvironment) throw new Error("Database runtime environment is missing.");

    const targetDatabaseInfo = scenario.assets.databases.find((database) => database.serverId === targetDatabase.id);
    if (!targetDatabaseInfo) throw new Error("Target database definition is missing.");
    const targetEnvironment = {
      ...initialTargetEnvironment,
      installedSoftware: [...targetDatabase.software],
      databaseVersion: targetDatabaseInfo.version,
      services: scenario.assets.services
        .filter((service) => service.serverId === targetDatabase.id)
        .map((service) => ({ ...service, status: "running" as const })),
    };
    const readyEnvironments = { ...environments, [targetDatabase.id]: targetEnvironment };
    const dns = initialDnsRuntime(scenario.assets.dns[0]);

    const exportResult = runCommand(sourceCommand, sourceDatabase, scenario, sourceEnvironment, readyEnvironments, dns, undefined, strategy);
    const importResult = runCommand(targetCommand, targetDatabase, scenario, targetEnvironment, readyEnvironments, dns, undefined, strategy);

    expect(exportResult.databaseTransfer).toBe("export");
    expect(importResult.databaseTransfer).toBe("import");
    if (strategy === "dataguard") {
      const synchronizedStandby = {
        ...targetEnvironment,
        databaseRole: "standby" as const,
        dataGuardEnabled: true,
        databaseRevision: sourceEnvironment.databaseRevision,
      };
      const switchover = runCommand(
        "dgmgrl switchover",
        targetDatabase,
        scenario,
        synchronizedStandby,
        { ...readyEnvironments, [targetDatabase.id]: synchronizedStandby },
        dns,
        undefined,
        strategy,
      );
      expect(switchover.databaseAction).toBe("switchover");
    }

    const wrongStrategy = runCommand(
      sourceCommand,
      sourceDatabase,
      scenario,
      sourceEnvironment,
      readyEnvironments,
      dns,
      undefined,
      strategy === "expdp" ? "rman" : "expdp",
    );
    expect(wrongStrategy.output[0]).toContain("project plan selects a different");
  });

  it("accepts a fully prepared cutover and flags rollback as the final state", () => {
    const project = {
      ...createInitialProjectWorkspace(scenario.project),
      ttlLeadDays: 3,
      noticeLeadDays: 1,
      noticeSent: true,
      rollbackPlan: "23:30までにDNSを旧APへ戻し、利用者へ連絡します。",
    };
    const events: AuditEvent[] = [
      { name: "database:expdp-export", at: 1 },
      { name: "database:expdp-import", at: 2 },
      { name: "migrate:database", at: 3 },
      { name: "verify:connectivity", at: 4 },
      { name: "dns:ttl-lowered", at: 5 },
      { name: "dns:ttl-prepared", at: 6 },
      { name: "project:notice-sent", at: 7 },
      { name: "project:decision:go", at: 8 },
      { name: "dns:cutover", at: 9 },
      { name: "verify:post-cutover", at: 10 },
    ];
    const readyItems = getCutoverReadiness(scenario, events, project, false);

    expect(readyItems.every((item) => item.ready)).toBe(true);

    const rolledBackEvents = [...events, { name: "dns:rollback", at: 11 }];
    const report = calculateAuditReport(scenario, rolledBackEvents, 1, 0, 60_000, project);

    expect(report.projectFindings.some((finding) => finding.id === "migration-rolled-back")).toBe(true);
    expect(getCutoverReadiness(scenario, rolledBackEvents, project, false)
      .find((item) => item.id === "connectivity")?.ready).toBe(false);
  });
});
