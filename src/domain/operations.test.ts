import { describe, expect, it } from "vitest";
import scenarioDefinition from "../data/scenarios/windows-server-2016-to-2019.json";
import { createInitialProjectWorkspace } from "./project";
import { calculateAuditReport } from "./progress";
import { loadScenario } from "./scenario";
import { createRuntimeEnvironments, updateRuntimeServiceStartupType } from "./simulator";

const scenario = loadScenario(scenarioDefinition);
const sourceApplication = scenario.assets.servers.find((server) =>
  server.role === "application" && server.stage === "source",
);
if (!sourceApplication) throw new Error("Scenario must define a source application server.");

describe("operational verification", () => {
  it("changes service startup mode without changing its runtime state", () => {
    const environment = createRuntimeEnvironments(scenario)[sourceApplication.id];
    const stoppedResin = {
      ...environment,
      services: environment.services.map((service) =>
        service.name.toLowerCase().includes("resin")
          ? { ...service, status: "stopped" as const, startupType: "manual" as const }
          : service,
      ),
    };
    const resin = stoppedResin.services.find((service) => service.name.toLowerCase().includes("resin"));
    if (!resin) throw new Error("Scenario must define a Resin service.");

    const updated = updateRuntimeServiceStartupType(stoppedResin, resin.id, "automatic");
    const updatedResin = updated.services.find((service) => service.id === resin.id);

    expect(updatedResin?.startupType).toBe("automatic");
    expect(updatedResin?.status).toBe("stopped");
    expect(stoppedResin.services.find((service) => service.id === resin.id)?.startupType).toBe("manual");
  });

  it("audits service startup and scheduled-task trial evidence", () => {
    const project = createInitialProjectWorkspace(scenario.project);
    const withoutEvidence = calculateAuditReport(scenario, [], 0, 0, 0, project);
    const withEvidence = calculateAuditReport(scenario, [
      { name: "verify:service-startup", at: 1 },
      { name: "verify:task-run", at: 2 },
    ], 0, 0, 0, project);
    const readinessCheck = withEvidence.checks.find(({ check }) => check.id === "verify-operational-readiness");
    const baselineOperations = withoutEvidence.projectScores.find((score) => score.id === "operations")?.score ?? 0;
    const verifiedOperations = withEvidence.projectScores.find((score) => score.id === "operations")?.score ?? 0;

    expect(readinessCheck?.complete).toBe(true);
    expect(verifiedOperations - baselineOperations).toBe(10);
  });
});
