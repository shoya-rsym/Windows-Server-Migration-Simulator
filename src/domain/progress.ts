import type { AuditCheck, DifficultyMode, LearningObjective, ProjectWorkspace, Scenario, TutorialStep } from "./models";

export interface AuditEvent {
  name: string;
  at: number;
}

function isCutoverPreflightInvalidator(eventName: string): boolean {
  return eventName.startsWith("migrate:")
    || eventName.startsWith("install:middleware:")
    || ["database:business-write", "database:final-sync", "database:dataguard-sync", "start:resin-service"].includes(eventName);
}

export interface KnowledgeRecord {
  id: string;
  serverId: string;
  title: string;
  explanation: string;
}

function lastEventIndex(events: AuditEvent[], name: string, beforeIndex = events.length): number {
  for (let index = Math.min(beforeIndex, events.length) - 1; index >= 0; index -= 1) {
    if (events[index].name === name) return index;
  }
  return -1;
}

function hasCompletedDatabaseMigration(strategy: ProjectWorkspace["migrationStrategy"], events: AuditEvent[]): boolean {
  const eventNames = new Set(events.map((event) => event.name));
  if (strategy === "expdp") {
    return eventNames.has("database:expdp-export")
      && eventNames.has("database:expdp-import")
      && eventNames.has("migrate:database");
  }
  if (strategy === "rman") {
    return eventNames.has("database:rman-backup")
      && eventNames.has("database:rman-restore")
      && eventNames.has("migrate:database");
  }
  return eventNames.has("database:dataguard-prepare")
    && eventNames.has("database:dataguard-start-standby")
    && eventNames.has("database:dataguard-switchover")
    && eventNames.has("migrate:database");
}

function auditRequirementIndex(checkId: string, requiredEvent: string, scenario: Scenario, events: AuditEvent[]): number {
  const cutoverIndex = lastEventIndex(events, "dns:cutover");
  const rollbackIndex = lastEventIndex(events, "dns:rollback");
  if (checkId === "reduce-dns-ttl" && requiredEvent === "dns:ttl-lowered") {
    if (!wasTtlPreparedBeforeCutover(scenario, events)) return -1;
    const beforeCutover = cutoverIndex < 0 ? events.length : cutoverIndex;
    const preparedIndex = lastEventIndex(events, "dns:ttl-prepared", beforeCutover);
    if (preparedIndex >= 0) return preparedIndex;
    const loweredIndex = lastEventIndex(events, "dns:ttl-lowered", beforeCutover);
    return loweredIndex >= 0 ? loweredIndex : Math.max(0, cutoverIndex);
  }
  if (checkId === "cutover-dns" && requiredEvent === "dns:cutover") {
    return cutoverIndex > rollbackIndex ? cutoverIndex : -1;
  }
  if (checkId === "verify-post-cutover" && requiredEvent === "verify:post-cutover") {
    return cutoverIndex > rollbackIndex && lastEventIndex(events, requiredEvent) > cutoverIndex
      ? lastEventIndex(events, requiredEvent)
      : -1;
  }
  if (checkId === "verify-cutover" && requiredEvent === "verify:connectivity") {
    const cycleEnd = cutoverIndex > rollbackIndex ? cutoverIndex : events.length;
    const cycleStart = cutoverIndex > rollbackIndex
      ? lastEventIndex(events, "dns:rollback", cutoverIndex)
      : rollbackIndex;
    const connectivityIndex = lastEventIndex(events, requiredEvent, cycleEnd);
    const latestChangeIndex = events.reduce((latestIndex, event, index) =>
      index > cycleStart && index < cycleEnd && isCutoverPreflightInvalidator(event.name)
        ? index
        : latestIndex, cycleStart);
    return connectivityIndex > latestChangeIndex ? connectivityIndex : -1;
  }
  return lastEventIndex(events, requiredEvent);
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

export interface CutoverReadinessItem {
  id: string;
  title: string;
  ready: boolean;
  detail: string;
}

export function getCutoverReadiness(
  scenario: Scenario,
  events: AuditEvent[],
  project: ProjectWorkspace,
  hasOpenIssues: boolean,
  databaseRevisions?: { source: number; target: number },
): CutoverReadinessItem[] {
  const rollbackIndex = lastEventIndex(events, "dns:rollback");
  const cutoverIndex = lastEventIndex(events, "dns:cutover");
  const cycleCutoverIndex = cutoverIndex > rollbackIndex ? cutoverIndex : -1;
  const cycleEndIndex = cycleCutoverIndex >= 0 ? cycleCutoverIndex : events.length;
  const databaseSyncPending = Boolean(databaseRevisions && databaseRevisions.source > databaseRevisions.target);
  const findings = new Set(getProjectFindings(scenario, events, project, databaseSyncPending).map((finding) => finding.id));
  const migrationChangeIndex = events.reduce((latestIndex, event, index) =>
    index > rollbackIndex && index < cycleEndIndex && isCutoverPreflightInvalidator(event.name)
      ? index
      : latestIndex, -1);
  const connectivityIndex = events.reduce((latestIndex, event, index) =>
    index > rollbackIndex && index < cycleEndIndex && event.name === "verify:connectivity"
      ? index
      : latestIndex, -1);
  const currentCycleNotice = events.some((event, index) =>
    index > rollbackIndex && index < cycleEndIndex && event.name === "project:notice-sent",
  );
  const ttlPlanReady = project.ttlLeadDays >= 3 && wasTtlPreparedBeforeCutover(scenario, events);

  return [
    {
      id: "connectivity",
      title: "移行先APの直接疎通",
      ready: connectivityIndex > migrationChangeIndex,
      detail: "最後の設定変更後に、APSV02宛てのHTTP 200を確認してください。",
    },
    {
      id: "database",
      title: "選択したDB方式の移行と同期",
      ready: hasCompletedDatabaseMigration(project.migrationStrategy, events)
        && !databaseSyncPending
        && !findings.has("database-final-sync"),
      detail: findings.has("database-migration-strategy")
        ? findings.has("database-final-sync")
          ? "選択方式の手順を完了し、最新のデータ世代まで同期してください。"
          : "案件デスクで選択したDB方式の実行手順を完了してください。"
        : "DB移行方式の実施と現行・移行先のデータ世代を確認してください。",
    },
    {
      id: "dns-ttl",
      title: "DNS TTLの計画と事前適用",
      ready: ttlPlanReady,
      detail: "3日前以上の短縮計画を立て、Aレコード変更とは別にTTLを300秒以下へ適用してください。",
    },
    {
      id: "user-notice",
      title: "今回の切替サイクルの利用者周知",
      ready: project.noticeSent && project.noticeLeadDays >= 1 && currentCycleNotice,
      detail: "停止時間・対象業務・問い合わせ先を記載し、前日までに周知記録を残してください。",
    },
    {
      id: "downtime",
      title: "許容停止時間内の作業計画",
      ready: !findings.has("downtime"),
      detail: `計画停止時間を${scenario.project.downtimeLimitMinutes}分以内に設定してください。`,
    },
    {
      id: "rollback-plan",
      title: "切戻し条件と手順",
      ready: !findings.has("rollback-plan"),
      detail: "判断期限、DNSを戻す手順、旧環境の維持時間、利用者連絡方法を具体化してください。",
    },
    {
      id: "unresolved-issues",
      title: "未解決の障害・ログ",
      ready: !hasOpenIssues,
      detail: "イベントビューアーなどで原因を特定し、移行先のエラーを解消してから判断してください。",
    },
  ];
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
    complete: check.requiredEvents.every((required) => auditRequirementIndex(check.id, required, scenario, events) >= 0),
    missingOperations: check.requiredEvents.flatMap((required, index) =>
      auditRequirementIndex(check.id, required, scenario, events) >= 0 ? [] : [check.operationGuidance[index] ?? required],
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
    const completionAt = Math.max(...check.requiredEvents.map((required) =>
      events[auditRequirementIndex(check.id, required, scenario, events)]?.at ?? 0,
    ));
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
  const ttlMissed = !wasTtlPreparedBeforeCutover(scenario, events);
  const estimatedDowntimeMinutes = missingCriticalChecks * 5 + (ttlMissed ? 30 : 0);
  const latestCutoverIndex = lastEventIndex(events, "dns:cutover");
  const cutoverAt = events[latestCutoverIndex]?.at;
  const investigationIndex = latestCutoverIndex < 0
    ? lastEventIndex(events, "investigate:events")
    : lastEventIndex(events, "investigate:events") > latestCutoverIndex
      ? lastEventIndex(events, "investigate:events")
      : -1;
  const investigationAt = events[investigationIndex]?.at;
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
  const databaseMigrationComplete = hasCompletedDatabaseMigration(project.migrationStrategy, events);
  const projectScores = calculateProjectScores(scenario, events, incidentCount, successRate, project, dataSyncPending, databaseMigrationComplete);
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
  databaseMigrationComplete: boolean,
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
  const cutoverDone = lastEventIndex(events, "dns:cutover") > lastEventIndex(events, "dns:rollback");
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
    (project.noticeSent ? 20 : 0)
    + (project.noticeSent && project.noticeLeadDays >= 1 ? 10 : 0)
    + (project.ttlLeadDays >= 3 ? 10 : 0)
    + (wasTtlPreparedBeforeCutover(scenario, events) ? 10 : 0)
    + (downtimeScore ? 15 : 0)
    + (hasRollbackPlan ? 15 : 0)
    + (project.cutoverDecision !== "pending" ? 10 : 0)
    + (eventNames.has("verify:task-run") ? 5 : 0)
    + (eventNames.has("verify:service-startup") ? 5 : 0);

  return [
    { id: "research", label: "調査品質", score: researchScore },
    { id: "design", label: "設計品質", score: designScore },
    { id: "migration", label: "移行品質", score: Math.max(0, migrationRate - (dataSyncPending ? 20 : 0) - (databaseMigrationComplete ? 0 : 20)) },
    { id: "incident", label: "障害対応", score: incidentResponseScore },
    { id: "security", label: "セキュリティ", score: securityScore },
    { id: "operations", label: "運用品質", score: operationsScore },
  ];
}

function wasTtlPreparedBeforeCutover(scenario: Scenario, events: AuditEvent[]): boolean {
  const cutoverIndex = lastEventIndex(events, "dns:cutover");
  const beforeCutover = cutoverIndex < 0 ? events.length : cutoverIndex;
  const preparedIndex = lastEventIndex(events, "dns:ttl-prepared", beforeCutover);
  const invalidatedIndex = lastEventIndex(events, "dns:ttl-invalidated", beforeCutover);
  if (preparedIndex > invalidatedIndex) {
    return true;
  }

  if ((scenario.assets.dns[0]?.ttlSeconds ?? Infinity) <= 300 && invalidatedIndex < 0) return true;

  const hasVersionedTtlEvents = events.some((event, index) =>
    index < beforeCutover && ["dns:ttl-prepared", "dns:ttl-invalidated"].includes(event.name),
  );
  const loweredDuringCurrentCutover = cutoverIndex >= 0
    && events.some((event, index) => event.name === "dns:ttl-lowered-during-cutover" && index > cutoverIndex);
  return !hasVersionedTtlEvents
    && !loweredDuringCurrentCutover
    && lastEventIndex(events, "dns:ttl-lowered", beforeCutover) >= 0;
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
    const syncRemediation = project.migrationStrategy === "rman"
      ? "現行DBで rman backup を再実行し、新DBで rman restore して、画面のデータ世代を一致させてください。バックアップ後の更新は復旧側へ自動反映されません。"
      : project.migrationStrategy === "dataguard"
        ? "Data GuardのApply状態を確認してください。Standbyを再同期し、移行元と移行先のデータ世代が一致してからスイッチオーバーしてください。"
        : "現行DBで expdp を再実行し、新DBで impdp して、画面のデータ世代を一致させてからGo判定します。";
    findings.push({
      id: "database-final-sync",
      title: "現行DBに新DBへ未反映の業務更新があります",
      remediation: syncRemediation,
    });
  }
  if (!hasCompletedDatabaseMigration(project.migrationStrategy, events)) {
    const remediation = project.migrationStrategy === "expdp"
      ? "計画方式に合わせ、現行DBで expdp、新DBで impdp を実行してください。業務更新後は最新世代を再エクスポート・インポートします。"
      : project.migrationStrategy === "rman"
        ? "現行DBで rman backup、新DBで rman restore を実行してください。バックアップ後に業務更新があれば、停止時間内に再バックアップ・リストアして最終世代を合わせます。"
        : "現行DBで dgmgrl prepare、新DBで dgmgrl start standby を実行します。データ世代が一致した後、新DBで dgmgrl switchover を実行してください。";
    findings.push({
      id: "database-migration-strategy",
      title: `計画したDB移行方式 (${project.migrationStrategy}) の実行が完了していません`,
      remediation,
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
  const cutoverIndex = lastEventIndex(events, "dns:cutover");
  const latestRollbackIndex = lastEventIndex(events, "dns:rollback");
  const cutoverCycleStartIndex = cutoverIndex >= 0
    ? latestRollbackIndex > cutoverIndex ? latestRollbackIndex : lastEventIndex(events, "dns:rollback", cutoverIndex)
    : latestRollbackIndex;
  const cutoverDone = cutoverIndex > latestRollbackIndex;
  const ttlPrepared = wasTtlPreparedBeforeCutover(scenario, events);
  const decisionEvents = events
    .map((event, index) => ({ event, index }))
    .filter(({ event, index }) =>
      index > cutoverCycleStartIndex
      && (event.name === "project:decision:go" || event.name === "project:decision:no-go"),
    );
  const latestDecision = decisionEvents[decisionEvents.length - 1];
  const noticeIndex = events.reduce((latestIndex, event, index) =>
    index > cutoverCycleStartIndex && event.name === "project:notice-sent" ? index : latestIndex, -1);
  const latestCutoverCacheStaleIndex = lastEventIndex(events, "dns:cutover-cache-stale");
  const latestCutoverCacheFlushIndex = lastEventIndex(events, "dns:cutover-cache-flushed");
  const latestRollbackCacheStaleIndex = lastEventIndex(events, "dns:rollback-cache-stale");
  const latestRollbackCacheFlushIndex = lastEventIndex(events, "dns:rollback-cache-flushed");
  const rollbackIsLatestTransition = latestRollbackIndex > cutoverIndex;
  const cutoverIsLatestTransition = cutoverIndex > latestRollbackIndex;
  if (rollbackIsLatestTransition
    && latestRollbackCacheStaleIndex > latestRollbackIndex
    && latestRollbackCacheFlushIndex < latestRollbackCacheStaleIndex) {
    findings.push({
      id: "rollback-dns-cache",
      title: "切戻し後のクライアントDNSキャッシュが旧環境を指していません",
      remediation: "接続端末で ipconfig /flushdns を実行し、nslookup intra.example.local で旧APのIPに解決されることを確認してください。",
    });
  }
  if (rollbackIsLatestTransition && lastEventIndex(events, "verify:rollback") < latestRollbackIndex) {
    findings.push({
      id: "rollback-verification",
      title: "切戻し後の旧環境を本番名で確認していません",
      remediation: "DNSキャッシュを更新した後、curl http://intra.example.local:8080/ を実行し、旧APでHTTP 200になることを確認してください。",
    });
  }
  if (cutoverIsLatestTransition
    && latestCutoverCacheStaleIndex > cutoverIndex
    && latestCutoverCacheFlushIndex < latestCutoverCacheStaleIndex) {
    const ttlChangedDuringCutover = events.some((event, index) =>
      event.name === "dns:ttl-lowered-during-cutover" && index > cutoverIndex,
    );
    findings.push({
      id: "cutover-dns-cache",
      title: "DNS切替後もクライアントDNSキャッシュが旧APを指しています",
      remediation: ttlChangedDuringCutover
        ? "TTL短縮とAレコード変更を同時に適用しても、旧TTLのキャッシュは更新されません。操作端末で ipconfig /flushdns を実行してnslookupとHTTP疎通を確認してください。次回はTTLだけを先に適用し、待機後にAレコードを切り替えてください。"
        : "操作端末で ipconfig /flushdns を実行してnslookup intra.example.local と curl http://intra.example.local:8080/ を確認してください。次回はTTLだけを先に300秒以下へ短縮し、待機後にAレコードを切り替えてください。",
    });
  }
  if (cutoverDone && !ttlPrepared) {
    findings.push({
      id: "ttl-operation-order",
      title: "DNS TTL短縮の計画と実施順序が一致していません",
      remediation: "切替済みの場合は操作端末でDNSキャッシュを確認し、必要なら ipconfig /flushdns 後に本番名で疎通してください。次回は案件デスクで切替3日前以上に計画し、DNSマネージャーでTTLだけを300秒以下に短縮・適用してからAレコードを変更してください。",
    });
  }
  if (cutoverDone && (!latestDecision || latestDecision.index > cutoverIndex)) {
    findings.push({
      id: "cutover-decision",
      title: "Go / No-Go判定を記録する前にDNSを切り替えています",
      remediation: "DNSを切り替える前に案件デスクの「切替判断」で事前疎通・作業計画・未解決リスクを確認し、GoまたはNo-Goを記録してください。",
    });
  }
  const latestGoIndex = events.reduce((latestIndex, event, index) =>
    index > cutoverCycleStartIndex && event.name === "project:decision:go" ? index : latestIndex, -1);
  const connectivityIndex = latestGoIndex < 0
    ? -1
    : lastEventIndex(events, "verify:connectivity", latestGoIndex);
  const preflightEndIndex = cutoverDone ? cutoverIndex : events.length;
  const latestPreflightChangeIndex = events.reduce((latestIndex, event, index) =>
    index > cutoverCycleStartIndex && index < preflightEndIndex && isCutoverPreflightInvalidator(event.name)
      ? index
      : latestIndex, cutoverCycleStartIndex);
  if (latestGoIndex >= 0
    && (connectivityIndex <= cutoverCycleStartIndex
      || connectivityIndex <= latestPreflightChangeIndex)) {
    findings.push({
      id: "preflight",
      title: "新環境の疎通確認前にGo判定、または切替を実施しています",
      remediation: "DNS切替前に新APへ直接接続し、アプリケーションとDBの応答を確認してからGo判定を記録してください。",
    });
  }
  if (cutoverDone && latestDecision?.event.name === "project:decision:no-go" && latestDecision.index < cutoverIndex) {
    findings.push({
      id: "no-go-cutover",
      title: "No-Go判定後にDNS切替が実施されています",
      remediation: "未解決事項を修正するか、切替を中止してください。既に切替済みの場合は影響を評価し、必要なら切戻してください。",
    });
  }
  if (cutoverDone && (noticeIndex < 0 || noticeIndex > cutoverIndex)) {
    findings.push({
      id: "late-user-notice",
      title: noticeIndex > cutoverIndex
        ? "DNS切替後に利用者周知を送信しています"
        : "今回の切替サイクル前に利用者周知を記録していません",
      remediation: "既に切替済みの場合は利用者影響と問い合わせ状況を確認してください。再切替前に停止時間・対象業務・問い合わせ先を周知し、送信記録を残してください。",
    });
  }
  if (rollbackIsLatestTransition) {
    findings.push({
      id: "migration-rolled-back",
      title: "最終状態は現行APへの切戻しです",
      remediation: "移行完了ではなく切戻しとして評価されています。新環境への移行を再開する場合は、原因を解消し、再切替前に疎通確認とGo判定をやり直してください。",
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
