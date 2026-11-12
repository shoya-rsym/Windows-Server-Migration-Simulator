import type {
  GameState,
  PhaseId,
  Scenario,
  ScoreBreakdown,
} from "./models";

export const initialGameState = (): GameState => ({
  currentPhase: "investigation",
  completedPhases: [],
  commandOutputs: [],
  architectureAnswer: null,
  buildOptions: {
    operatingSystem: "Windows Server 2019",
    javaVersion: "Java 8",
    resinVersion: "Resin 4.0",
  },
  databaseMethod: null,
  migratedAssets: [],
  cutover: {
    finalSync: false,
    ttlMinutes: 1440,
    dnsSwitched: false,
    servicesSwitched: false,
  },
  activeIncident: null,
  incidentSolved: false,
  incidentAttempted: false,
  downtimeMinutes: 0,
  migrationSuccess: 100,
  riskPoints: 0,
  eventLog: ["09:00  更改プロジェクトを開始しました。"],
});

export function getScore(state: GameState): ScoreBreakdown {
  const architecture = state.completedPhases.includes("architecture") ? 20 : 0;
  const migration = Math.max(0, Math.round(state.migrationSuccess * 0.4));
  const downtime = Math.max(0, 20 - Math.floor(state.downtimeMinutes / 5));
  const incidentResponse = state.completedPhases.includes("incident-response")
    ? state.incidentSolved
      ? 20
      : 5
    : 0;

  return {
    architecture,
    migration,
    downtime,
    incidentResponse,
    total: Math.min(100, architecture + migration + downtime + incidentResponse),
  };
}

export function getPhaseStatus(
  phaseId: PhaseId,
  index: number,
  completed: PhaseId[],
): "completed" | "active" | "locked" {
  if (completed.includes(phaseId)) return "completed";
  if (index === completed.length) return "active";
  return "locked";
}

export function canCompletePhase(state: GameState, scenario: Scenario): boolean {
  switch (state.currentPhase) {
    case "investigation":
      return state.commandOutputs.length >= scenario.commands.length;
    case "architecture":
      return state.architectureAnswer === "correct";
    case "build":
      return state.buildOptions.operatingSystem === "Windows Server 2019";
    case "database-migration":
      return state.databaseMethod !== null;
    case "application-migration":
      return state.migratedAssets.length >= 5;
    case "cutover":
      return state.cutover.finalSync && state.cutover.dnsSwitched && state.cutover.servicesSwitched;
    case "incident-response":
      return state.incidentSolved;
  }
}

export function completeCurrentPhase(state: GameState, scenario: Scenario): GameState {
  if (!canCompletePhase(state, scenario)) return state;

  const phaseIndex = scenario.phases.findIndex((phase) => phase.id === state.currentPhase);
  const completedPhases = state.completedPhases.includes(state.currentPhase)
    ? state.completedPhases
    : [...state.completedPhases, state.currentPhase];
  const nextPhase = scenario.phases[phaseIndex + 1]?.id;
  const nextState: GameState = {
    ...state,
    completedPhases,
    currentPhase: nextPhase ?? state.currentPhase,
    eventLog: [...state.eventLog, `${String(9 + phaseIndex).padStart(2, "0")}:00  ${scenario.phases[phaseIndex].title}を完了しました。`],
  };

  if (nextPhase === "incident-response" && !nextState.activeIncident) {
    const migratedIncidentAssets = new Set(nextState.migratedAssets);
    if (migratedIncidentAssets.has("resin")) migratedIncidentAssets.add("service");
    const missingIncidents = scenario.incidents.filter(
      (item) => !migratedIncidentAssets.has(item.requiredAsset),
    );
    const incidentPool = missingIncidents.length > 0 ? missingIncidents : scenario.incidents;
    const incident = incidentPool[Math.floor(Math.random() * incidentPool.length)];
    nextState.activeIncident = incident;
    nextState.incidentSolved = false;
    nextState.eventLog = [...nextState.eventLog, `切替後障害: ${incident.title}が発生しました。`];
  }

  return nextState;
}

export function makeInitialState(): GameState {
  return initialGameState();
}
