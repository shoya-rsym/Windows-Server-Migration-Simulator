import type { AuditCheck, DifficultyMode, LearningObjective, Scenario, TutorialStep } from "./models";

export interface AuditEvent {
  name: string;
  at: number;
}

export interface KnowledgeRecord {
  id: string;
  serverId: string;
  title: string;
  explanation: string;
}

export interface AuditReport {
  checks: Array<{ check: AuditCheck; complete: boolean; missingOperations: string[] }>;
  successRate: number;
  incidentCount: number;
  elapsedMinutes: number;
  estimatedDowntimeMinutes: number;
  recoveryMinutes: number | null;
  orderWarnings: string[];
  review: string;
}

export interface TutorialProgress {
  activeStep: TutorialStep | undefined;
  previousStep: TutorialStep | undefined;
  completedCount: number;
}

export function getTutorialProgress(steps: TutorialStep[], events: AuditEvent[]): TutorialProgress {
  const isComplete = (step: TutorialStep) =>
    step.requiredEvents.every((required) => events.some((event) => event.name === required));
  const activeIndex = steps.findIndex((step) => !isComplete(step));
  return {
    activeStep: activeIndex === -1 ? undefined : steps[activeIndex],
    previousStep: activeIndex <= 0 ? undefined : steps[activeIndex - 1],
    completedCount: steps.filter(isComplete).length,
  };
}

export function getModeObjective(
  mode: DifficultyMode,
  objectives: LearningObjective[],
  completedIds: string[],
  orderByMode: Record<DifficultyMode, string[]>,
): LearningObjective | undefined {
  const order = orderByMode[mode];
  const orderedObjectives = order.length
    ? [...order.map((id) => objectives.find((objective) => objective.id === id)).filter((item): item is LearningObjective => item !== undefined), ...objectives.filter((item) => !order.includes(item.id))]
    : objectives;
  return orderedObjectives.find((objective) => !completedIds.includes(objective.id));
}

export function calculateAuditReport(
  scenario: Scenario,
  events: AuditEvent[],
  incidentCount: number,
  startedAt: number,
  now = Date.now(),
): AuditReport {
  const checks = scenario.auditChecks.map((check) => ({
    check,
    complete: check.requiredEvents.every((required) => events.some((event) => event.name === required)),
    missingOperations: check.requiredEvents.flatMap((required, index) =>
      events.some((event) => event.name === required) ? [] : [check.operationGuidance[index] ?? required],
    ),
  }));
  const totalWeight = scenario.auditChecks.reduce((sum, check) => sum + check.weight, 0);
  const achievedWeight = checks.reduce((sum, item) => sum + (item.complete ? item.check.weight : 0), 0);
  const successRate = totalWeight === 0 ? 0 : Math.round((achievedWeight / totalWeight) * 100);
  const orderRank = new Map(scenario.recommendedOrder.map((id, index) => [id, index]));
  const performedChecks = checks.flatMap(({ check, complete }) => {
    if (!complete) return [];
    const rank = orderRank.get(check.id);
    if (rank === undefined) return [];
    const completionAt = Math.max(...check.requiredEvents.map((required) => events.find((event) => event.name === required)?.at ?? 0));
    return [{ check, rank, completionAt }];
  }).sort((left, right) => left.completionAt - right.completionAt);
  const orderWarnings: string[] = [];
  for (let index = 1; index < performedChecks.length; index += 1) {
    const previous = performedChecks[index - 1];
    const current = performedChecks[index];
    if (current.rank < previous.rank) {
      orderWarnings.push(`「${current.check.title}」を「${previous.check.title}」より後に実施しました。推奨順序を確認してください。`);
    }
  }
  const missingCriticalChecks = checks.filter(
    ({ check, complete }) => !complete && ["migrate-database", "migrate-jdbc", "migrate-services", "start-resin", "cutover-dns"].includes(check.id),
  ).length;
  const ttlMissed = !events.some((event) => event.name === "dns:ttl-lowered");
  const estimatedDowntimeMinutes = missingCriticalChecks * 5 + (ttlMissed ? 30 : 0);
  const cutoverAt = events.find((event) => event.name === "dns:cutover")?.at;
  const investigationAt = events.find((event) => event.name === "investigate:events")?.at;
  const recoveryMinutes = incidentCount === 0
    ? 0
    : cutoverAt !== undefined && investigationAt !== undefined
      ? Math.max(1, Math.ceil((investigationAt - cutoverAt) / 60_000))
      : null;
  const missingTitles = checks.filter((item) => !item.complete).map((item) => item.check.title);
  const review = buildReview(successRate, ttlMissed, missingTitles, orderWarnings, incidentCount);

  return {
    checks,
    successRate,
    incidentCount,
    elapsedMinutes: Math.max(1, Math.ceil((now - startedAt) / 60_000)),
    estimatedDowntimeMinutes,
    recoveryMinutes,
    orderWarnings,
    review,
  };
}

function buildReview(
  successRate: number,
  ttlMissed: boolean,
  missingTitles: string[],
  orderWarnings: string[],
  incidentCount: number,
): string {
  const notes: string[] = [];
  if (successRate >= 80) notes.push("多くの移行・確認作業を完了できています。");
  else notes.push("移行前調査と資産移行に未完了項目があります。監査結果から手順を見直してください。");
  if (ttlMissed) notes.push("DNS TTLの事前短縮が記録されていません。本番切替ではキャッシュによる利用者影響に注意してください。");
  if (orderWarnings.length) notes.push(orderWarnings[0]);
  if (incidentCount > 0) notes.push(`切替後に${incidentCount}件のイベントが残っています。ログと構成差分を確認してください。`);
  if (missingTitles.length) notes.push(`未完了: ${missingTitles.slice(0, 3).join("、")}${missingTitles.length > 3 ? " ほか" : ""}。`);
  if (incidentCount === 0 && missingTitles.length === 0) notes.push("切替後の重大なイベントは確認されませんでした。");
  return notes.join(" ");
}
