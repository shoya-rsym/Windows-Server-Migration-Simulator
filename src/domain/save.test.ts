import { describe, expect, it } from "vitest";
import scenarioDefinition from "../data/scenarios/windows-server-2016-to-2019.json";
import { createInitialCloudWorkspace } from "./cloud";
import { createInitialProjectWorkspace } from "./project";
import { loadScenario } from "./scenario";
import { parseSimulationSave } from "./save";
import { createRuntimeEnvironments, initialDnsRuntime } from "./simulator";

const scenario = loadScenario(scenarioDefinition);
const sourceApplication = scenario.assets.servers.find((server) =>
  server.role === "application" && server.stage === "source",
);
const targetApplication = scenario.assets.servers.find((server) =>
  server.role === "application" && server.stage === "target",
);

function createSave() {
  if (!sourceApplication || !targetApplication) throw new Error("Scenario must define source and target application servers.");
  const dns = initialDnsRuntime(scenario.assets.dns[0]);
  return {
    version: 2 as const,
    mode: "tutorial" as const,
    provider: "onprem" as const,
    paneServerIds: [sourceApplication.id, targetApplication.id] as [string, string],
    environments: createRuntimeEnvironments(scenario),
    dns,
    dnsDraft: dns,
    history: {},
    inputs: {},
    activeApps: {},
    shellModes: {},
    transfer: null,
    hypotheses: [],
    drafts: {},
    taskRuns: {},
    completedObjectives: [],
    knowledgeRecords: [],
    auditEvents: [],
    startedAt: 1,
    entryId: 0,
    projectWorkspace: createInitialProjectWorkspace(scenario.project),
    expertIncidentId: null,
    cloudWorkspace: createInitialCloudWorkspace(),
  };
}

describe("simulation saves", () => {
  it("accepts a complete current save", () => {
    expect(parseSimulationSave(createSave())).not.toBeNull();
  });

  it("keeps compatibility with older version 2 saves", () => {
    const { cloudWorkspace: _cloudWorkspace, projectWorkspace: _projectWorkspace, ...legacySave } = createSave();
    const environments = Object.fromEntries(Object.entries(legacySave.environments).map(([serverId, environment]) => {
      const {
        installedSoftware: _installedSoftware,
        databaseRevision: _databaseRevision,
        databaseRole: _databaseRole,
        dataGuardEnabled: _dataGuardEnabled,
        ...legacyEnvironment
      } = environment;
      return [serverId, legacyEnvironment];
    }));

    expect(parseSimulationSave({ ...legacySave, environments })).not.toBeNull();
  });

  it("rejects malformed nested runtime data instead of resuming it", () => {
    const save = createSave();
    const firstServerId = Object.keys(save.environments)[0];
    const malformedSave = {
      ...save,
      environments: {
        ...save.environments,
        [firstServerId]: { ...save.environments[firstServerId], services: [{ id: "incomplete" }] },
      },
    };

    expect(parseSimulationSave(malformedSave)).toBeNull();
  });
});
