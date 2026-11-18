import { createRuntimeEnvironments, initialDnsRuntime, type DnsRuntime } from "./simulator";
import { createInitialProjectWorkspace } from "./project";
import type { ProjectWorkspace, RuntimeEnvironments, Scenario } from "./models";

export interface ObservationPreview {
  environments: RuntimeEnvironments;
  dns: DnsRuntime;
  dnsDraft: DnsRuntime;
  taskRuns: Record<string, string>;
  projectWorkspace: ProjectWorkspace;
}

export function createObservationPreview(scenario: Scenario, stepId: string): ObservationPreview {
  const environments = createRuntimeEnvironments(scenario);
  const dnsAsset = scenario.assets.dns[0];
  if (!dnsAsset) throw new Error("観察モードに必要なDNSレコードがありません。");
  let dns = initialDnsRuntime(dnsAsset);
  const taskRuns: Record<string, string> = {};
  const projectWorkspace = createInitialProjectWorkspace(scenario.project);
  const stepIndex = scenario.tutorialSteps.findIndex((step) => step.id === stepId);
  if (stepIndex < 0) throw new Error(`観察モードの手順が見つかりません: ${stepId}`);
  const completedSteps = new Set(scenario.tutorialSteps.slice(0, stepIndex + 1).map((step) => step.id));
  const hasCompleted = (...ids: string[]) => ids.some((id) => completedSteps.has(id));
  const server = (role: "application" | "database", stage: "source" | "target") => {
    const result = scenario.assets.servers.find((item) => item.role === role && item.stage === stage);
    if (!result) throw new Error(`観察プレビューに必要なサーバーがありません: ${stage} ${role}`);
    return result;
  };
  const environment = (serverId: string) => {
    const result = environments[serverId];
    if (!result) throw new Error(`観察プレビューの実行環境がありません: ${serverId}`);
    return result;
  };

  if (hasCompleted("record-investigation-notes")) {
    const recordedAt = Date.now();
    projectWorkspace.investigationNotes = [
      {
        id: "observation-current-ap",
        title: "現行APサーバー",
        detail: "APSV01 は Windows Server 2016、Java 8、Resin 4.0。確認したコマンド出力を移行先の互換性確認に使います。",
        createdAt: recordedAt,
      },
      {
        id: "observation-current-db",
        title: "現行DB接続先",
        detail: "jdbc.properties と resin.conf の接続先は DBSV01:1521:ORCL。移行後に両方をDBSV02向けへ変更します。",
        createdAt: recordedAt,
      },
      {
        id: "observation-dns-baseline",
        title: "本番DNSの現行値",
        detail: `${dnsAsset.name} は APSV01 を指し、TTLは ${dnsAsset.ttlSeconds} 秒。切替計画の基準値として記録します。`,
        createdAt: recordedAt,
      },
    ];
  }
  if (hasCompleted("map-architecture")) {
    projectWorkspace.architectureEdges = scenario.project.dependencies.map((dependency) => ({
      id: dependency.id,
      from: dependency.from,
      to: dependency.to,
    }));
  }
  if (hasCompleted("review-project-documents")) {
    projectWorkspace.readDocumentIds = scenario.projectDocuments.map((document) => document.id);
  }
  if (hasCompleted("review-project-mail")) {
    projectWorkspace.readMailIds = scenario.projectMails.map((mail) => mail.id);
  }
  if (hasCompleted("review-project-teams")) {
    projectWorkspace.chatResponses = scenario.projectChats
      .filter((thread) => ["ネットワーク担当", "DBA"].includes(thread.senderRole))
      .flatMap((thread) => {
        const recommendedChoice = thread.choices.find((choice) => choice.recommended);
        return recommendedChoice
          ? [{ threadId: thread.id, choiceId: recommendedChoice.id, chosenAt: Date.now() }]
          : [];
      });
  }
  if (hasCompleted("review-project-meeting")) {
    projectWorkspace.meetingRecords = scenario.projectMeetings.map((meeting) => ({
      meetingId: meeting.id,
      recordedAt: Date.now(),
      decisions: meeting.agendaItems.flatMap((agendaItem) => {
        const recommendedChoice = agendaItem.choices.find((choice) => choice.recommended);
        return recommendedChoice
          ? [{ agendaItemId: agendaItem.id, choiceId: recommendedChoice.id }]
          : [];
      }),
    }));
  }
  if (hasCompleted("review-project-effort") && scenario.projectEffortPackages.length > 0) {
    const document = scenario.projectDocuments.find((item) => item.id === "operations-manual")
      ?? scenario.projectDocuments[0];
    if (!document) throw new Error("観察プレビューの工数見積に必要な案件資料がありません。");
    const section = document.sections.find((item) => item.id === "operations-window") ?? document.sections[0];
    if (!section) throw new Error("観察プレビューの工数見積に必要な資料箇所がありません。");
    projectWorkspace.estimatedPersonHours = scenario.projectEffortPackages
      .reduce((total, item) => total + item.actualPersonHours, 0);
    projectWorkspace.estimateRationale = "現行調査、資料確認、関係者調整、移行先構築、DB/AP移行、切替・試験、障害対応までを見積対象に含めました。作業枠と停止上限は運用設計書の記載を根拠にしています。";
    projectWorkspace.estimateDocumentId = document.id;
    projectWorkspace.estimateSectionId = section.id;
    projectWorkspace.estimateConfirmedAt = Date.now();
  }
  if (hasCompleted("prepare-project-plan")) {
    projectWorkspace.ttlLeadDays = 3;
    projectWorkspace.rollbackPlan = "切替後30分以内に主要業務を確認する。未復旧またはデータ不整合時はDNSをAPSV01へ戻し、旧環境とDNSキャッシュを確認する。";
  }
  if (hasCompleted("send-user-notice")) {
    projectWorkspace.noticeLeadDays = 1;
    projectWorkspace.noticeSubject = "基幹業務システムの切替作業について";
    projectWorkspace.noticeBody = `${scenario.project.downtimeWindow} にシステム切替を予定しています。対象業務は基幹業務システムです。作業中はログイン・更新ができません。お問い合わせ先: 運用窓口。`;
    projectWorkspace.noticeSent = true;
  }
  if (hasCompleted("approve-cutover")) projectWorkspace.cutoverDecision = "go";

  if (hasCompleted("install-target-ap")) {
    const target = server("application", "target");
    environment(target.id).installedSoftware = [...target.software];
  }
  if (hasCompleted("install-target-oracle")) {
    const target = server("database", "target");
    const targetEnvironment = environment(target.id);
    targetEnvironment.installedSoftware = [...target.software];
    targetEnvironment.databaseVersion = scenario.assets.databases.find((item) => item.serverId === target.id)?.version ?? null;
  }
  if (hasCompleted("start-and-inspect-target-oracle")) {
    const target = server("database", "target");
    const targetEnvironment = environment(target.id);
    targetEnvironment.services = scenario.assets.services
      .filter((item) => item.serverId === target.id)
      .map((item) => ({ ...item, status: "running" as const }));
  }
  if (hasCompleted("migrate-database")) {
    const source = environment(server("database", "source").id);
    const target = environment(server("database", "target").id);
    target.databaseSchemas = [...source.databaseSchemas];
    target.databaseRevision = source.databaseRevision;
  }
  if (hasCompleted("migrate-jdbc")) {
    const source = environment(server("application", "source").id);
    const target = environment(server("application", "target").id);
    target.jdbcProperties = source.jdbcProperties?.replace(/DBSV01/g, "DBSV02") ?? null;
  }
  if (hasCompleted("migrate-services")) {
    const source = environment(server("application", "source").id);
    const target = environment(server("application", "target").id);
    target.services = source.services.map((service) => ({
      ...service,
      serverId: server("application", "target").id,
      status: "stopped",
    }));
  }
  if (hasCompleted("migrate-resin-config")) {
    const targetServer = server("application", "target");
    const target = environment(targetServer.id);
    const source = environment(server("application", "source").id);
    target.configurationFiles = source.configurationFiles.map((file) => ({
      ...file,
      serverId: targetServer.id,
      content: file.content
        .replace(/10\.10\.1\.21/g, targetServer.ipAddress)
        .replace(/DBSV01/g, "DBSV02"),
    }));
  }
  if (hasCompleted("migrate-tasks")) {
    const targetId = server("application", "target").id;
    environment(targetId).tasks = environment(server("application", "source").id).tasks
      .map((task) => ({ ...task, serverId: targetId }));
  }
  if (hasCompleted("migrate-certificates")) {
    const targetId = server("application", "target").id;
    environment(targetId).certificates = environment(server("application", "source").id).certificates
      .map((certificate) => ({ ...certificate, serverId: targetId }));
  }
  if (hasCompleted("start-resin")) {
    const target = environment(server("application", "target").id);
    target.services = target.services.map((service) =>
      service.name.toLowerCase().includes("resin") ? { ...service, status: "running" } : service,
    );
  }
  if (hasCompleted("verify-operational-readiness")) {
    const target = environment(server("application", "target").id);
    target.services = target.services.map((service) =>
      service.name.toLowerCase().includes("resin") ? { ...service, startupType: "automatic" } : service,
    );
    target.tasks.forEach((task) => { taskRuns[task.id] = "成功 (0x0)"; });
  }
  if (hasCompleted("reduce-dns-ttl")) dns = { ...dns, ttlSeconds: 300 };
  if (hasCompleted("cutover-dns")) {
    dns = {
      ...dns,
      address: server("application", "target").ipAddress,
      cachedAddress: server("application", "target").ipAddress,
    };
  }

  return { environments, dns, dnsDraft: { ...dns }, taskRuns, projectWorkspace };
}
