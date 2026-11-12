import type { AuditCheck, DifficultyMode, LearningObjective, ProjectWorkspace, Scenario, TutorialStep } from "./models";

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
  projectScores: Array<{ id: string; label: string; score: number }>;
  projectFindings: Array<{ id: string; title: string; remediation: string }>;
  overallGrade: string;
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
  projectWorkspace?: ProjectWorkspace,
  databaseRevisions?: { source: number; target: number },
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
  const project = projectWorkspace ?? {
    investigationNotes: [],
    architectureEdges: [],
    plannedDowntimeMinutes: scenario.project.downtimeLimitMinutes,
    maintenanceWindow: scenario.project.downtimeWindow,
    ttlLeadDays: 0,
    noticeLeadDays: 0,
    noticeSubject: "",
    noticeBody: "",
    noticeSent: false,
    migrationStrategy: "expdp" as const,
    rollbackPlan: "",
    cutoverDecision: "pending" as const,
  };
  const dataSyncPending = Boolean(databaseRevisions && databaseRevisions.source > databaseRevisions.target);
  const projectScores = calculateProjectScores(scenario, events, incidentCount, successRate, project, dataSyncPending);
  const projectFindings = getProjectFindings(scenario, events, project, dataSyncPending);
  const averageScore = Math.round(projectScores.reduce((total, item) => total + item.score, 0) / projectScores.length);
  const overallGrade = gradeFor(averageScore);
  const review = buildReview(successRate, ttlMissed, missingTitles, orderWarnings, incidentCount, overallGrade, projectFindings);

  return {
    checks,
    successRate,
    incidentCount,
    elapsedMinutes: Math.max(1, Math.ceil((now - startedAt) / 60_000)),
    estimatedDowntimeMinutes,
    recoveryMinutes,
    orderWarnings,
    projectScores,
    projectFindings,
    overallGrade,
    review,
  };
}

function calculateProjectScores(
  scenario: Scenario,
  events: AuditEvent[],
  incidentCount: number,
  migrationRate: number,
  project: ProjectWorkspace,
  dataSyncPending: boolean,
): AuditReport["projectScores"] {
  const eventNames = new Set(events.map((event) => event.name));
  const investigationEvents = events.filter((event) => event.name.startsWith("inspect:") || event.name.startsWith("investigate:"));
  const noteScore = Math.min(100, project.investigationNotes.filter((note) => note.title.trim() && note.detail.trim()).length * 34);
  const researchScore = Math.round(noteScore * 0.7 + Math.min(100, investigationEvents.length * 25) * 0.3);
  const expectedEdges = scenario.project.dependencies;
  const submittedEdges = project.architectureEdges;
  const matchingEdges = expectedEdges.filter((expected) => submittedEdges.some((actual) =>
    normalize(actual.from) === normalize(expected.from) && normalize(actual.to) === normalize(expected.to),
  )).length;
  const dependencyScore = expectedEdges.length === 0
    ? 100
    : Math.round((matchingEdges / Math.max(expectedEdges.length, submittedEdges.length)) * 100);
  const downtimeScore = project.plannedDowntimeMinutes <= scenario.project.downtimeLimitMinutes ? 100 : 0;
  const hasRollbackPlan = project.rollbackPlan.trim().length >= 20;
  const designScore = Math.round(dependencyScore * 0.6 + downtimeScore * 0.2 + (hasRollbackPlan ? 20 : 0));
  const cutoverDone = eventNames.has("dns:cutover");
  const eventLogReviewed = eventNames.has("investigate:events");
  const incidentResponseScore = cutoverDone
    ? incidentCount === 0 ? 100 : eventLogReviewed ? Math.max(20, 70 - incidentCount * 15) : Math.max(0, 40 - incidentCount * 15)
    : eventLogReviewed ? 60 : 40;
  const securityChecks = scenario.auditChecks.filter((check) => /certificate|ssl|jdbc|security/i.test(check.id));
  const securityScore = securityChecks.length
    ? Math.round(securityChecks.reduce((score, check) => score + (check.requiredEvents.every((required) => eventNames.has(required)) ? check.weight : 0), 0)
      / securityChecks.reduce((weight, check) => weight + check.weight, 0) * 100)
    : migrationRate;
  const operationsScore =
    (project.noticeSent ? 25 : 0)
    + (project.noticeSent && project.noticeLeadDays >= 1 ? 15 : 0)
    + (project.ttlLeadDays >= 3 ? 20 : 0)
    + (downtimeScore ? 15 : 0)
    + (hasRollbackPlan ? 15 : 0)
    + (project.cutoverDecision !== "pending" ? 10 : 0);

  return [
    { id: "research", label: "調査品質", score: researchScore },
    { id: "design", label: "設計品質", score: designScore },
    { id: "migration", label: "移行品質", score: Math.max(0, migrationRate - (dataSyncPending ? 20 : 0)) },
    { id: "incident", label: "障害対応", score: incidentResponseScore },
    { id: "security", label: "セキュリティ", score: securityScore },
    { id: "operations", label: "運用品質", score: operationsScore },
  ];
}

function getProjectFindings(
  scenario: Scenario,
  events: AuditEvent[],
  project: ProjectWorkspace,
  dataSyncPending: boolean,
): AuditReport["projectFindings"] {
  const findings: AuditReport["projectFindings"] = [];
  const capturedNotes = project.investigationNotes.filter((note) => note.title.trim() && note.detail.trim());
  if (capturedNotes.length === 0) {
    findings.push({
      id: "research-notes",
      title: "調査結果が案件ノートに記録されていません",
      remediation: "案件デスクの「調査・構成」で、調査したサーバー・バージョン・接続先と判断根拠を記録してください。",
    });
  }
  const missingDependencies = scenario.project.dependencies.filter((expected) => !project.architectureEdges.some((actual) =>
    normalize(actual.from) === normalize(expected.from) && normalize(actual.to) === normalize(expected.to),
  ));
  if (missingDependencies.length) {
    findings.push({
      id: "architecture",
      title: `構成図に依存関係が${missingDependencies.length}件不足しています`,
      remediation: `案件デスクの「調査・構成」で、${missingDependencies.slice(0, 3).map((edge) => `${edge.from} → ${edge.to}`).join("、")}を追加し、調査結果と照合してください。`,
    });
  }
  if (project.plannedDowntimeMinutes > scenario.project.downtimeLimitMinutes) {
    findings.push({
      id: "downtime",
      title: "計画停止時間が案件の許容時間を超えています",
      remediation: `停止計画を${scenario.project.downtimeLimitMinutes}分以内に見直し、データ移行と確認に必要な時間を再見積もりしてください。`,
    });
  }
  if (dataSyncPending) {
    findings.push({
      id: "database-final-sync",
      title: "現行DBに新DBへ未反映の業務更新があります",
      remediation: "切替前に現行DBを再エクスポートし、新DBへインポートしてください。画面のデータ世代が一致したことを確認してからGo判定します。",
    });
  }
  if (project.ttlLeadDays < 3) {
    findings.push({
      id: "ttl-plan",
      title: "DNS TTL短縮の事前計画が不足しています",
      remediation: "案件デスクの「計画・周知」で、切替の3日前までにTTLを短縮する計画を設定してください。",
    });
  }
  if (!project.noticeSent || project.noticeLeadDays < 1) {
    findings.push({
      id: "user-notice",
      title: "利用者周知が未送信、または周知期間が不足しています",
      remediation: "停止時間・対象業務・問い合わせ先を記載した案内を作成し、少なくとも前日までに送信する計画にしてください。",
    });
  }
  if (project.rollbackPlan.trim().length < 20) {
    findings.push({
      id: "rollback-plan",
      title: "切戻し条件と手順が具体化されていません",
      remediation: "判断期限、DNSを旧APへ戻す手順、旧環境を維持する時間、利用者への連絡方法を記載してください。",
    });
  }
  const cutoverDone = events.some((event) => event.name === "dns:cutover");
  if (cutoverDone && project.cutoverDecision === "pending") {
    findings.push({
      id: "cutover-decision",
      title: "Go / No-Go判定を記録せずにDNSを切り替えています",
      remediation: "案件デスクの「切替判断」で、事前疎通・作業計画・未解決リスクを確認して判定を記録してください。",
    });
  }
  if (project.cutoverDecision === "go" && !events.some((event) => event.name === "verify:connectivity")) {
    findings.push({
      id: "preflight",
      title: "切替前の疎通確認をせずにGo判定しています",
      remediation: "DNS切替前に新APへ直接接続し、アプリケーションとDBの応答を確認してから判定してください。",
    });
  }
  if (project.cutoverDecision === "no-go" && cutoverDone) {
    findings.push({
      id: "no-go-cutover",
      title: "No-Go判定後にDNS切替が実施されています",
      remediation: "未解決事項を修正するか、切替を中止してください。既に切替済みの場合は影響を評価し、必要なら切戻してください。",
    });
  }
  return findings;
}

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, "").toLocaleLowerCase();
}

function gradeFor(score: number): string {
  if (score >= 95) return "S";
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  return "D";
}

function buildReview(
  successRate: number,
  ttlMissed: boolean,
  missingTitles: string[],
  orderWarnings: string[],
  incidentCount: number,
  overallGrade: string,
  projectFindings: AuditReport["projectFindings"],
): string {
  const notes: string[] = [];
  notes.push(`案件運営を含む総合評価は${overallGrade}です。`);
  if (successRate >= 80) notes.push("多くの移行・確認作業を完了できています。");
  else notes.push("移行前調査と資産移行に未完了項目があります。監査結果から手順を見直してください。");
  if (ttlMissed) notes.push("DNS TTLの事前短縮が記録されていません。本番切替ではキャッシュによる利用者影響に注意してください。");
  if (orderWarnings.length) notes.push(orderWarnings[0]);
  if (incidentCount > 0) notes.push(`切替後に${incidentCount}件のイベントが残っています。ログと構成差分を確認してください。`);
  if (missingTitles.length) notes.push(`未完了: ${missingTitles.slice(0, 3).join("、")}${missingTitles.length > 3 ? " ほか" : ""}。`);
  if (projectFindings.length) notes.push(`案件運営上の改善点: ${projectFindings.slice(0, 2).map((finding) => finding.title).join("、")}。`);
  if (incidentCount === 0 && missingTitles.length === 0) notes.push("切替後の重大なイベントは確認されませんでした。");
  return notes.join(" ");
}
