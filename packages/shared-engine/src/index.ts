export type SESkill =
  | "investigation"
  | "requirements"
  | "design"
  | "architecture"
  | "development"
  | "testing"
  | "review"
  | "communication"
  | "riskManagement"
  | "incidentResponse"
  | "operation"
  | "projectManagement";

export type ProjectLifecyclePhase =
  | "investigation"
  | "requirements"
  | "planning"
  | "design"
  | "implementation"
  | "testing"
  | "release"
  | "operation"
  | "incident"
  | "review";

export interface SimulationEvent<TPayload = unknown> {
  id: string;
  type: string;
  occurredAt: number;
  payload: TPayload;
}

export interface SimulationState {
  scenarioId: string;
  events: SimulationEvent[];
  completedObjectives: string[];
}

export function createSimulationState(scenarioId: string): SimulationState {
  if (!scenarioId.trim()) throw new Error("シナリオIDが必要です。");
  return { scenarioId, events: [], completedObjectives: [] };
}

export function recordSimulationEvent<TPayload>(
  state: SimulationState,
  event: SimulationEvent<TPayload>,
): SimulationState {
  if (!event.id.trim() || !event.type.trim()) throw new Error("イベントIDとイベント種別が必要です。");
  if (state.events.some((existing) => existing.id === event.id)) {
    throw new Error(`イベントIDが重複しています: ${event.id}`);
  }
  return { ...state, events: [...state.events, event] };
}

export function completeLearningObjective(state: SimulationState, objectiveId: string): SimulationState {
  if (!objectiveId.trim()) throw new Error("学習目標IDが必要です。");
  return state.completedObjectives.includes(objectiveId)
    ? state
    : { ...state, completedObjectives: [...state.completedObjectives, objectiveId] };
}
