import { useEffect, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock3,
  Database,
  FolderOpen,
  FileKey2,
  FileText,
  FolderClock,
  HardDrive,
  Lightbulb,
  ListTodo,
  LockKeyhole,
  MessageCircle,
  Monitor,
  Power,
  Network,
  Play,
  RotateCcw,
  Server as ServerIcon,
  Settings,
  Shield,
  Terminal,
  X,
} from "lucide-react";
import { AwsConsole } from "./components/AwsConsole";
import { createLocalAdvisor } from "./domain/advisor";
import {
  createRuntimeEnvironments,
  createExpertRuntimeEnvironments,
  chooseExpertIncident,
  getEventLog,
  initialDnsRuntime,
  jdbcPropertiesTargetDatabase,
  runCommand,
  updateRuntimeServiceStartupType,
  type DnsRuntime,
} from "./domain/simulator";
import { createInitialCloudWorkspace, isCloudWorkspaceReady } from "./domain/cloud";
import type {
  Certificate,
  CloudWorkspace,
  ConsoleEntry,
  DatabaseMigrationStrategy,
  DeploymentProvider,
  DifficultyMode,
  Advisor,
  HypothesisNote,
  ManagerApp,
  ProjectWorkspace,
  RuntimeEnvironment,
  RuntimeEnvironments,
  RuntimeService,
  Scenario,
  Server,
  Task,
  TransferPackage,
} from "./domain/models";
import { loadScenario } from "./domain/scenario";
import { createInitialProjectWorkspace } from "./domain/project";
import { parseSimulationSave, type SimulationSave } from "./domain/save";
import {
  calculateAuditReport,
  deriveTutorialEvents,
  getCutoverReadiness,
  getModeObjective,
  getTutorialInstruction,
  getTutorialProgress,
  getTutorialSteps,
  type AuditEvent,
  type CutoverReadinessItem,
  type KnowledgeRecord,
} from "./domain/progress";

const scenarioModules = import.meta.glob("./data/scenarios/*.json", { eager: true, import: "default" });
const scenarios = Object.values(scenarioModules).map(loadScenario);
if (scenarios.length === 0) throw new Error("シナリオJSONが見つかりません。");
const defaultAdvisor = createLocalAdvisor();
type DesktopShortcut = "cmd" | "powershell" | "explorer" | ManagerApp;
type ShellMode = "cmd" | "powershell";

function readSimulationSave(saveKey: string): { save: SimulationSave | null; error: string | null } {
  try {
    const raw = window.localStorage.getItem(saveKey);
    if (!raw) return { save: null, error: null };
    const parsed: unknown = JSON.parse(raw);
    const save = parseSimulationSave(parsed);
    if (!save) throw new Error("保存データの形式が一致しません。最初から開始してください。");
    return { save, error: null };
  } catch (error) {
    return {
      save: null,
      error: error instanceof Error ? error.message : "保存データを読み込めませんでした。",
    };
  }
}

function isManagerShortcut(shortcut: DesktopShortcut): shortcut is ManagerApp {
  return shortcut !== "cmd" && shortcut !== "powershell";
}

function jdbcDraftKey(serverId: string): string {
  return `jdbc:${serverId}`;
}

function resinConfigDraftKey(serverId: string): string {
  return `resinConfig:${serverId}`;
}

function getAvailableServers(scenario: Scenario, provider: DeploymentProvider, workspace: CloudWorkspace): Server[] {
  return scenario.assets.servers.filter((server) =>
    provider === "onprem"
    || server.stage !== "target"
    || (workspace.instanceServerIds.includes(server.id) && workspace.securityGroupPorts.includes(3389)),
  );
}

function createLegacyCloudWorkspace(scenario: Scenario): CloudWorkspace {
  const targetServers = scenario.assets.servers.filter((server) => server.stage === "target");
  const firstIp = targetServers[0]?.ipAddress.split(".") ?? ["10", "10", "2", "0"];
  return {
    vpcCidr: `${firstIp[0]}.${firstIp[1]}.0.0/16`,
    subnetCidr: `${firstIp[0]}.${firstIp[1]}.${firstIp[2]}.0/24`,
    securityGroupCreated: true,
    securityGroupPorts: [3389, 8080, 1521],
    instanceServerIds: targetServers.map((server) => server.id),
  };
}

function isEmptyCloudWorkspace(workspace: CloudWorkspace): boolean {
  return !workspace.vpcCidr
    && !workspace.subnetCidr
    && !workspace.securityGroupCreated
    && workspace.securityGroupPorts.length === 0
    && workspace.instanceServerIds.length === 0;
}

function App({ advisor = defaultAdvisor }: { advisor?: Advisor } = {}) {
  const [selectedScenarioId, setSelectedScenarioId] = useState(scenarios[0].id);
  const scenario = scenarios.find((item) => item.id === selectedScenarioId);
  if (!scenario) throw new Error(`Unknown scenario: ${selectedScenarioId}`);
  return <SimulationApp key={scenario.id} scenario={scenario} scenarios={scenarios} advisor={advisor} onScenarioChange={setSelectedScenarioId} />;
}

function SimulationApp({ scenario, scenarios, advisor, onScenarioChange }: {
  scenario: Scenario;
  scenarios: Scenario[];
  advisor: Advisor;
  onScenarioChange: (scenarioId: string) => void;
}) {
  const initialDns = initialDnsRuntime(scenario.assets.dns[0]);
  const sourceApplication = scenario.assets.servers.find((server) => server.role === "application" && server.stage === "source");
  const targetApplication = scenario.assets.servers.find((server) => server.role === "application" && server.stage === "target");
  const sourceDatabase = scenario.assets.servers.find((server) => server.role === "database" && server.stage === "source");
  const targetDatabase = scenario.assets.servers.find((server) => server.role === "database" && server.stage === "target");
  const dnsServer = scenario.assets.servers.find((server) => server.role === "dns");
  const initialPanes: [string, string] = [
    sourceApplication?.id ?? scenario.assets.servers[0].id,
    targetApplication?.id ?? sourceApplication?.id ?? scenario.assets.servers[0].id,
  ];
  const saveKey = `windows-server-migration-simulator:${scenario.id}:v2`;
  const [storedRead] = useState(() => readSimulationSave(saveKey));
  const [storedSave, setStoredSave] = useState<SimulationSave | null>(storedRead.save);
  const [storageError, setStorageError] = useState(storedRead.error);
  const [screen, setScreen] = useState<"desktop" | "lab">("desktop");
  const [sessionStarted, setSessionStarted] = useState(false);
  const [mode, setMode] = useState<DifficultyMode>("tutorial");
  const [provider, setProvider] = useState<DeploymentProvider>("onprem");
  const [cloudWorkspace, setCloudWorkspace] = useState<CloudWorkspace>(() => createInitialCloudWorkspace());
  const [desktopShortcut, setDesktopShortcut] = useState<DesktopShortcut>("cmd");
  const [desktopServerId, setDesktopServerId] = useState(initialPanes[0]);
  const [knowledgeOpen, setKnowledgeOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [projectDeskOpen, setProjectDeskOpen] = useState(false);
  const [guideFeedback, setGuideFeedback] = useState("");
  const [advisorFeedback, setAdvisorFeedback] = useState("");
  const [advisorLoading, setAdvisorLoading] = useState(false);
  const [paneServerIds, setPaneServerIds] = useState<[string, string]>(initialPanes);
  const [environments, setEnvironments] = useState<RuntimeEnvironments>(() => createRuntimeEnvironments(scenario));
  const [dns, setDns] = useState<DnsRuntime>(initialDns);
  const [dnsDraft, setDnsDraft] = useState<DnsRuntime>(initialDns);
  const [history, setHistory] = useState<Record<string, ConsoleEntry[]>>({});
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [activeApps, setActiveApps] = useState<Record<string, ManagerApp | null>>({});
  const [shellModes, setShellModes] = useState<Record<string, ShellMode>>({});
  const [transfer, setTransfer] = useState<TransferPackage | null>(null);
  const [hypotheses, setHypotheses] = useState<HypothesisNote[]>([]);
  const [hypothesisInput, setHypothesisInput] = useState("");
  const [notesOpen, setNotesOpen] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [taskRuns, setTaskRuns] = useState<Record<string, string>>({});
  const [completedObjectives, setCompletedObjectives] = useState<string[]>([]);
  const [knowledgeRecords, setKnowledgeRecords] = useState<KnowledgeRecord[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [projectWorkspace, setProjectWorkspace] = useState<ProjectWorkspace>(() => createInitialProjectWorkspace(scenario.project));
  const [expertIncidentId, setExpertIncidentId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState(Date.now);
  const [notice, setNotice] = useState("");
  const [entryId, setEntryId] = useState(0);

  useEffect(() => {
    if (!sessionStarted) return;
    const snapshot: SimulationSave = {
      version: 2,
      mode,
      provider,
      paneServerIds,
      environments,
      dns,
      dnsDraft,
      history,
      inputs,
      activeApps,
      shellModes,
      transfer,
      hypotheses,
      drafts,
      taskRuns,
      completedObjectives,
      knowledgeRecords,
      auditEvents,
      startedAt,
      entryId,
      projectWorkspace,
      expertIncidentId,
      cloudWorkspace,
    };
    try {
      window.localStorage.setItem(saveKey, JSON.stringify(snapshot));
      setStoredSave(snapshot);
      setStorageError(null);
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : "進行状況を保存できませんでした。");
    }
  }, [
    sessionStarted, mode, provider, paneServerIds, environments, dns, dnsDraft, history, inputs,
    activeApps, shellModes, transfer, hypotheses, drafts, taskRuns, completedObjectives, knowledgeRecords,
    auditEvents, startedAt, entryId, projectWorkspace, expertIncidentId,
    cloudWorkspace,
  ]);

  const recordAuditEvent = (name: string, allowRepeat = false) => {
    setAuditEvents((previous) => !allowRepeat && previous.some((event) => event.name === name)
      ? previous
      : [...previous, { name, at: Date.now() }]);
  };

  const startFreshSession = (confirmReset = false) => {
    if (confirmReset && !window.confirm("現在の進行状況を破棄して、最初からやり直しますか？")) return;
    try {
      window.localStorage.removeItem(saveKey);
      setStorageError(null);
      setStoredSave(null);
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : "保存データを削除できませんでした。");
    }
    const availableServers = getAvailableServers(scenario, provider, cloudWorkspace);
    const serverId = availableServers.some((server) => server.id === desktopServerId)
      ? desktopServerId
      : availableServers[0]?.id ?? initialPanes[0];
    const secondServerId = availableServers.some((server) => server.id === initialPanes[1])
      ? initialPanes[1]
      : serverId;
    const isManager = isManagerShortcut(desktopShortcut);
    setPaneServerIds([serverId, secondServerId]);
    const expertIncident = mode === "expert" ? chooseExpertIncident(scenario) : null;
    setExpertIncidentId(expertIncident?.id ?? null);
    setEnvironments(expertIncident
      ? createExpertRuntimeEnvironments(scenario, expertIncident.id)
      : createRuntimeEnvironments(scenario));
    const startupDns = (mode === "advanced" || mode === "expert") && targetApplication
      ? { ...initialDns, address: targetApplication.ipAddress, cachedAddress: targetApplication.ipAddress }
      : initialDns;
    setDns(startupDns);
    setDnsDraft(startupDns);
    setHistory({});
    setInputs({});
    setActiveApps(isManager ? { [serverId]: desktopShortcut } : {});
    setShellModes(desktopShortcut === "powershell" ? { [serverId]: "powershell" } : {});
    setTransfer(null);
    setHypotheses([]);
    setHypothesisInput("");
    setDrafts({});
    setTaskRuns({});
    setCompletedObjectives([]);
    setKnowledgeRecords([]);
    setAuditEvents([]);
    setProjectWorkspace(createInitialProjectWorkspace(scenario.project));
    setEntryId(0);
    setGuideFeedback("");
    setAdvisorFeedback("");
    setKnowledgeOpen(false);
    setHypothesisInput("");
    setStartedAt(Date.now());
    setReportOpen(false);
    setProjectDeskOpen(false);
    setSessionStarted(true);
    setScreen("lab");
  };

  const continueSession = () => {
    if (!storedSave) return;
    setMode(storedSave.mode);
    setProvider(storedSave.provider);
    const savedCloudWorkspace = storedSave.cloudWorkspace ?? createInitialCloudWorkspace();
    setCloudWorkspace(storedSave.provider !== "onprem" && isEmptyCloudWorkspace(savedCloudWorkspace)
      ? createLegacyCloudWorkspace(scenario)
      : savedCloudWorkspace);
    setPaneServerIds(storedSave.paneServerIds);
    setEnvironments(Object.fromEntries(Object.entries(storedSave.environments).map(([serverId, environment]) => {
      const server = scenario.assets.servers.find((item) => item.id === serverId);
      return [serverId, {
        ...environment,
        installedSoftware: environment.installedSoftware ?? [...(server?.software ?? [])],
        databaseRevision: environment.databaseRevision ?? 0,
        databaseRole: environment.databaseRole ?? (server?.stage === "source" ? "primary" : "unconfigured"),
        dataGuardEnabled: environment.dataGuardEnabled ?? false,
      }];
    })));
    setDns(storedSave.dns);
    setDnsDraft(storedSave.dnsDraft);
    setHistory(storedSave.history);
    setInputs(storedSave.inputs);
    setActiveApps(storedSave.activeApps);
    setShellModes(storedSave.shellModes);
    setTransfer(storedSave.transfer);
    setHypotheses(storedSave.hypotheses);
    setDrafts(Object.fromEntries(Object.entries(storedSave.drafts).filter(([key]) =>
      key.startsWith("jdbc:") || key.startsWith("resinConfig:"),
    )));
    setTaskRuns(storedSave.taskRuns);
    setCompletedObjectives(storedSave.completedObjectives);
    setKnowledgeRecords(storedSave.knowledgeRecords);
    setAuditEvents(storedSave.auditEvents);
    setProjectWorkspace(storedSave.projectWorkspace ?? createInitialProjectWorkspace(scenario.project));
    setExpertIncidentId(storedSave.expertIncidentId ?? null);
    setStartedAt(storedSave.startedAt);
    setEntryId(storedSave.entryId);
    setSessionStarted(true);
    setReportOpen(false);
    setProjectDeskOpen(false);
    setScreen("lab");
  };

  const notify = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3000);
  };

  const sendUserNotice = () => {
    if (!projectWorkspace.noticeSubject.trim() || !projectWorkspace.noticeBody.trim()) {
      notify("利用者周知の件名と本文を入力してください。");
      return;
    }
    setProjectWorkspace((previous) => ({ ...previous, noticeSent: true }));
    recordAuditEvent("project:notice-sent", true);
    notify("利用者周知を送信した記録を保存しました。");
  };

  const recordCutoverDecision = (decision: ProjectWorkspace["cutoverDecision"]) => {
    setProjectWorkspace((previous) => ({ ...previous, cutoverDecision: decision }));
    recordAuditEvent(`project:decision:${decision}`, true);
    const incompleteReadiness = decision === "go" ? cutoverReadiness.filter((item) => !item.ready) : [];
    notify(incompleteReadiness.length
      ? `Go判定を記録しました。未完了の確認項目: ${incompleteReadiness.slice(0, 2).map((item) => item.title).join("、")}${incompleteReadiness.length > 2 ? ` ほか${incompleteReadiness.length - 2}件` : ""}`
      : `切替判断を記録しました: ${decision === "go" ? "Go" : decision === "no-go" ? "No-Go" : decision}`);
  };

  const rollbackCutover = () => {
    if (!sourceApplication) throw new Error("切戻し先の現行APサーバーがシナリオにありません。");
    const restoredDns = { ...dns, address: sourceApplication.ipAddress };
    setDns(restoredDns);
    setDnsDraft(restoredDns);
    setProjectWorkspace((previous) => ({ ...previous, cutoverDecision: "rollback" }));
    recordAuditEvent("project:rollback", true);
    recordAuditEvent("dns:rollback", true);
    if (dns.cachedAddress !== sourceApplication.ipAddress) recordAuditEvent("dns:rollback-cache-stale", true);
    notify(`DNSを現行AP ${sourceApplication.hostname} に戻しました。クライアントキャッシュは ${dns.cachedAddress} のままです。必要に応じて ipconfig /flushdns を実行してください。`);
  };

  const openApp = (serverId: string, app: ManagerApp | null) => {
    setActiveApps((previous) => ({ ...previous, [serverId]: app }));
    if (app === "events") recordAuditEvent("investigate:events", true);
    if (app === "database") {
      const server = scenario.assets.servers.find((item) => item.id === serverId);
      if (server) recordAuditEvent(`inspect:oracle:${server.stage}`);
      const objective = scenario.learningObjectives.find((item) => item.id === "oracle-version");
      if (objective) {
        setCompletedObjectives((previous) => previous.includes(objective.id) ? previous : [...previous, objective.id]);
        setKnowledgeRecords((previous) => previous.some((record) => record.id === objective.id)
          ? previous
          : [...previous, { id: objective.id, serverId, title: objective.title, explanation: objective.explanation }]);
        if (mode === "tutorial" || mode === "beginner") setGuideFeedback(objective.explanation);
      }
    }
  };

  const execute = (serverId: string, rawCommand: string) => {
    const server = scenario.assets.servers.find((item) => item.id === serverId);
    const environment = environments[serverId];
    if (!server || !environment) throw new Error(`Unknown server session: ${serverId}`);
    const result = runCommand(
      rawCommand,
      server,
      scenario,
      environment,
      environments,
      dns,
      provider !== "onprem" ? cloudWorkspace.securityGroupPorts : undefined,
      projectWorkspace.migrationStrategy,
    );
    const normalized = rawCommand.trim().toLowerCase().replace(/\s+/g, " ");
    const lastAuditEventIndex = (name: string) => auditEvents.reduce(
      (latestIndex, event, index) => event.name === name ? index : latestIndex,
      -1,
    );
    const latestCutoverIndex = lastAuditEventIndex("dns:cutover");
    const latestRollbackIndex = lastAuditEventIndex("dns:rollback");
    const cutoverIsCurrent = latestCutoverIndex > latestRollbackIndex;
    const rollbackIsCurrent = latestRollbackIndex > latestCutoverIndex;

    if (result.databaseTransfer === "export") {
      exportAsset(serverId, "database", undefined, projectWorkspace.migrationStrategy);
    } else if (result.databaseTransfer === "import") {
      if (!transfer || transfer.kind !== "database" || transfer.sourceServerId === serverId) {
        result.output = ["ORA-39002: invalid operation", "Create a database migration package on the source DB before importing on the target."];
        notify("移行データがありません。選択した方式の手順で移行元DBから準備してください。");
      } else if ((transfer.strategy ?? "expdp") !== projectWorkspace.migrationStrategy) {
        result.output = ["ORA-39002: migration method mismatch", "The prepared database package does not match the strategy selected in the project plan."];
        notify("移行データの方式と案件デスクの選択が一致しません。選択方式で移行データを作成し直してください。");
      } else {
        const { schemas, revision } = transfer;
        const synchronizedRevision = projectWorkspace.migrationStrategy === "dataguard" && sourceDatabase
          ? environments[sourceDatabase.id]?.databaseRevision ?? revision
          : revision;
        if (importAsset(serverId)) {
          result.output = projectWorkspace.migrationStrategy === "rman"
            ? [`RMAN restore completed.`, `Recovered schemas: ${schemas.join(", ")}`, `Database revision: ${revision}`, "Updates after this backup require another backup and restore."]
            : projectWorkspace.migrationStrategy === "dataguard"
              ? [`Physical standby started.`, `Applied schemas: ${schemas.join(", ")}`, `Synchronized revision: ${synchronizedRevision}`, "Subsequent source updates will be applied automatically."]
              : [`Imported schemas: ${schemas.join(", ")}`, `Database revision: ${revision}`, "Job \"SYS_IMPORT_SCHEMA_01\" successfully completed."];
        } else {
          result.output = ["ORA-39002: Data Pump import failed. Check the target database and transfer package."];
        }
      }
    }
    if (result.databaseAction === "switchover") {
      if (!sourceDatabase || !targetDatabase) throw new Error("Data Guard switchover requires source and target database servers.");
      const sourceEnvironment = environments[sourceDatabase.id];
      const targetEnvironment = environments[targetDatabase.id];
      if (!sourceEnvironment || !targetEnvironment) throw new Error("Data Guard database runtime state is unavailable.");
      setEnvironments((previous) => ({
        ...previous,
        [sourceDatabase.id]: { ...sourceEnvironment, databaseRole: "standby", dataGuardEnabled: true },
        [targetDatabase.id]: { ...targetEnvironment, databaseRole: "primary" },
      }));
      recordAuditEvent("database:dataguard-switchover", true);
      recordAuditEvent("database:final-sync", true);
    }

    if (result.clear) {
      setHistory((previous) => ({ ...previous, [serverId]: [] }));
      setInputs((previous) => ({ ...previous, [serverId]: "" }));
      return;
    }

    const objective = scenario.learningObjectives.find(
      (item) => item.serverRole === server.role && item.commands.includes(normalized),
    );
    if (objective) {
      setCompletedObjectives((previous) => previous.includes(objective.id) ? previous : [...previous, objective.id]);
      setKnowledgeRecords((previous) => previous.some((record) => record.id === objective.id)
        ? previous
        : [...previous, { id: objective.id, serverId, title: objective.title, explanation: objective.explanation }]);
      if (mode === "tutorial" || mode === "beginner") setGuideFeedback(objective.explanation);
    }

    if (normalized === "systeminfo" && server.role === "application" && server.stage === "source") recordAuditEvent("inspect:os:source");
    if (normalized === "hostname" && server.role === "application" && server.stage === "source") recordAuditEvent("inspect:hostname:source");
    if (normalized === "java -version" && server.role === "application" && server.stage === "source") recordAuditEvent("inspect:java:source");
    if ((normalized === "sqlplus" || normalized === "sqlplus / as sysdba" || normalized === "lsnrctl status") && server.role === "database") {
      recordAuditEvent(`inspect:oracle:${server.stage}`);
    }
    if (result.managerApp === "events") recordAuditEvent("investigate:events", true);
    if (targetApplication && result.output[0] === "HTTP/1.1 200 OK") {
      const requestHost = normalized.match(/^curl http:\/\/([^/:]+)/)?.[1];
      if (requestHost === targetApplication.hostname.toLowerCase()) {
        recordAuditEvent("verify:connectivity", true);
      }
      if (requestHost === scenario.assets.dns[0].name.toLowerCase()
        && dns.address === targetApplication.ipAddress
        && dns.cachedAddress === targetApplication.ipAddress
        && cutoverIsCurrent) {
        recordAuditEvent("verify:post-cutover", true);
      }
    }
    if (sourceApplication && result.output[0] === "HTTP/1.1 200 OK") {
      const requestHost = normalized.match(/^curl http:\/\/([^/:]+)/)?.[1];
      if (requestHost === scenario.assets.dns[0].name.toLowerCase()
        && dns.address === sourceApplication.ipAddress
        && dns.cachedAddress === sourceApplication.ipAddress
        && rollbackIsCurrent) {
        recordAuditEvent("verify:rollback", true);
      }
    }

    if (result.flushDns) {
      recordAuditEvent("dns:flush", true);
      const cutoverCacheStaleIndex = lastAuditEventIndex("dns:cutover-cache-stale");
      const cutoverCacheFlushedIndex = lastAuditEventIndex("dns:cutover-cache-flushed");
      if (cutoverIsCurrent
        && cutoverCacheStaleIndex > latestCutoverIndex
        && cutoverCacheFlushedIndex < cutoverCacheStaleIndex
        && dns.address === targetApplication?.ipAddress
        && dns.cachedAddress !== dns.address) {
        recordAuditEvent("dns:cutover-cache-flushed", true);
      }
      const rollbackCacheStaleIndex = lastAuditEventIndex("dns:rollback-cache-stale");
      const rollbackCacheFlushedIndex = lastAuditEventIndex("dns:rollback-cache-flushed");
      if (rollbackIsCurrent
        && rollbackCacheStaleIndex > latestRollbackIndex
        && rollbackCacheFlushedIndex < rollbackCacheStaleIndex
        && dns.address === sourceApplication?.ipAddress
        && dns.cachedAddress !== dns.address) {
        recordAuditEvent("dns:rollback-cache-flushed", true);
      }
      setDns((previous) => ({ ...previous, cachedAddress: previous.address }));
    }

    if (rawCommand.trim()) {
      setEntryId((previous) => previous + 1);
      setHistory((previous) => ({
        ...previous,
        [serverId]: [
          ...(previous[serverId] ?? []),
          { id: entryId + 1, command: rawCommand.trim(), output: result.output },
        ],
      }));
    }
    if (result.managerApp) openApp(serverId, result.managerApp);
    setInputs((previous) => ({ ...previous, [serverId]: "" }));
  };

  const exportAsset = (
    serverId: string,
    kind: TransferPackage["kind"],
    content?: string,
    databaseStrategy: DatabaseMigrationStrategy = "expdp",
  ) => {
    const environment = environments[serverId];
    if (!environment) throw new Error(`Unknown server session: ${serverId}`);

    if (kind === "services") {
      setTransfer({ kind, sourceServerId: serverId, items: environment.services });
    } else if (kind === "tasks") {
      setTransfer({ kind, sourceServerId: serverId, items: environment.tasks });
    } else if (kind === "certificates") {
      setTransfer({ kind, sourceServerId: serverId, items: environment.certificates });
    } else if (kind === "jdbc") {
      if (content === undefined) throw new Error("JDBC configuration content is required.");
      setTransfer({ kind, sourceServerId: serverId, content });
    } else if (kind === "configFile") {
      if (!environment.configurationFiles.length) throw new Error("移行元に Resin 設定ファイルがありません。");
      setTransfer({ kind, sourceServerId: serverId, items: environment.configurationFiles });
    } else {
      setTransfer({
        kind,
        sourceServerId: serverId,
        schemas: environment.databaseSchemas,
        revision: environment.databaseRevision ?? 0,
        strategy: databaseStrategy,
      });
      recordAuditEvent(databaseStrategy === "expdp"
        ? "database:expdp-export"
        : databaseStrategy === "rman"
          ? "database:rman-backup"
          : "database:dataguard-prepare", true);
    }
    notify(kind === "database"
      ? databaseStrategy === "rman" ? "RMANバックアップを作成しました。" : databaseStrategy === "dataguard" ? "Data Guardの初期同期データを準備しました。" : "Data Pumpの移行データを作成しました。"
      : "エクスポート用の移行データを作成しました");
  };

  const importAsset = (serverId: string) => {
    if (!transfer || transfer.sourceServerId === serverId) return false;
    const target = environments[serverId];
    if (!target) throw new Error(`Unknown server session: ${serverId}`);
    const targetServer = scenario.assets.servers.find((item) => item.id === serverId);
    if (!targetServer) throw new Error(`Unknown server asset: ${serverId}`);
    if (targetServer.stage === "target" && transfer.kind === "services") {
      const requiredPrefix = targetServer.role === "application" ? "resin " : "oracle ";
      if (!target.installedSoftware.some((item) => item.toLowerCase().startsWith(requiredPrefix))) {
        notify(`${targetServer.role === "application" ? "Resin" : "Oracle Database"}を先にインストールしてください。`);
        return false;
      }
    }
    if (targetServer.stage === "target" && transfer.kind === "database") {
      if ((transfer.strategy ?? "expdp") !== projectWorkspace.migrationStrategy) {
        notify("移行データの方式と案件デスクの選択が一致しません。選択方式で移行データを作成し直してください。");
        return false;
      }
      if (!target.databaseVersion) {
        notify("移行先へOracle Databaseをインストールしてからデータを適用してください。");
        return false;
      }
      if (!target.services.some((service) => service.name.toLowerCase().startsWith("oracleservice") && service.status === "running")) {
        notify("Data Pumpのインポート前に、services.mscでOracleサービスを起動してください。");
        return false;
      }
    }
    const sourceRevision = sourceDatabase ? environments[sourceDatabase.id]?.databaseRevision ?? 0 : 0;
    const appliedRevision = transfer.kind === "database" && transfer.strategy === "dataguard"
      ? sourceRevision
      : transfer.kind === "database" ? transfer.revision ?? 0 : 0;

    if (transfer.kind === "services") {
      const items: RuntimeService[] = transfer.items.map((service) => ({
        ...service,
        serverId,
        status: "stopped",
      }));
      setEnvironments((previous) => ({ ...previous, [serverId]: { ...target, services: items } }));
    } else if (transfer.kind === "tasks") {
      const items: Task[] = transfer.items.map((task) => ({ ...task, serverId }));
      setEnvironments((previous) => ({ ...previous, [serverId]: { ...target, tasks: items } }));
    } else if (transfer.kind === "certificates") {
      const items: Certificate[] = transfer.items.map((certificate) => ({ ...certificate, serverId }));
      setEnvironments((previous) => ({ ...previous, [serverId]: { ...target, certificates: items } }));
    } else if (transfer.kind === "configFile") {
      const items = transfer.items.map((file) => ({ ...file, serverId }));
      setEnvironments((previous) => ({ ...previous, [serverId]: { ...target, configurationFiles: items } }));
      setDrafts((previous) => ({ ...previous, [resinConfigDraftKey(serverId)]: items[0]?.content ?? "" }));
    } else if (transfer.kind === "jdbc") {
      setEnvironments((previous) => ({ ...previous, [serverId]: { ...target, jdbcProperties: transfer.content } }));
      setDrafts((previous) => ({ ...previous, [jdbcDraftKey(serverId)]: transfer.content }));
    } else {
      setEnvironments((previous) => ({
        ...previous,
        [serverId]: {
          ...target,
          databaseSchemas: [...transfer.schemas],
          databaseRevision: appliedRevision,
          databaseRole: transfer.strategy === "dataguard" ? "standby" : target.databaseRole,
          dataGuardEnabled: transfer.strategy === "dataguard",
        },
      }));
    }

    const auditKind: Record<TransferPackage["kind"], string> = {
      services: "migrate:services",
      tasks: "migrate:tasks",
      certificates: "migrate:certificates",
      configFile: "migrate:resin-config",
      jdbc: "migrate:jdbc",
      database: "migrate:database",
    };
    if (transfer.kind !== "jdbc") recordAuditEvent(auditKind[transfer.kind]);
    if (transfer.kind === "database") {
      recordAuditEvent(transfer.strategy === "rman"
        ? "database:rman-restore"
        : transfer.strategy === "dataguard"
          ? "database:dataguard-start-standby"
          : "database:expdp-import", true);
    }
    const completedFinalSync = transfer.kind === "database"
      && serverId === targetDatabase?.id
      && sourceRevision > 0
      && transfer.revision === sourceRevision
      && transfer.strategy !== "dataguard";
    if (completedFinalSync) recordAuditEvent("database:final-sync");
    setTransfer(null);
    notify(transfer.kind === "jdbc"
      ? "JDBC設定を受け取りました。DBSV02向けに接続先を修正して保存してください。"
      : completedFinalSync && transfer.strategy !== "dataguard"
        ? `DBSV02を現行DBの最新データ世代 ${sourceRevision} に同期しました。`
        : transfer.kind === "database" && transfer.strategy === "dataguard" && sourceRevision > transfer.revision
          ? `Data Guard standbyを現行DBの最新データ世代 ${sourceRevision} まで同期しました。`
        : transfer.kind === "database" && sourceRevision > transfer.revision
            ? transfer.strategy === "rman"
              ? `バックアップ世代 ${transfer.revision} を復元しましたが、現行DBは世代 ${sourceRevision} です。再バックアップしてリストアしてください。`
              : `データ世代 ${transfer.revision} を取り込みましたが、現行DBは世代 ${sourceRevision} です。最新状態を再エクスポートしてください。`
          : "移行データを取り込みました。設定値を確認してください");
    return true;
  };

  const toggleService = (serverId: string, serviceId: string) => {
    const target = environments[serverId];
    if (!target) throw new Error(`Unknown server session: ${serverId}`);
    const service = target.services.find((item) => item.id === serviceId);
    if (service?.status === "stopped") {
      const software = target.installedSoftware ?? [];
      if (service.name.toLowerCase().includes("resin")
        && !software.some((item) => item.toLowerCase().startsWith("resin "))) {
        notify("Resinがインストールされていません。先にソフトウェア構成から導入してください。");
        return;
      }
      if (service.name.toLowerCase().includes("resin")
        && !software.some((item) => item.toLowerCase().startsWith("java "))) {
        notify("Resinの起動にはJavaが必要です。先にJavaをインストールしてください。");
        return;
      }
      if (service.name.toLowerCase().startsWith("oracleservice")
        && !software.some((item) => item.toLowerCase().startsWith("oracle "))) {
        notify("Oracle Databaseがインストールされていません。先にソフトウェア構成から導入してください。");
        return;
      }
    }
    if (serverId === targetApplication?.id && service?.name.toLowerCase().includes("resin") && service.status === "stopped") {
      recordAuditEvent("start:resin-service");
    }
    if (serverId === targetDatabase?.id
      && service?.name.toLowerCase().startsWith("oracleservice")
      && service.status === "stopped") {
      recordAuditEvent("start:oracle-service");
    }
    setEnvironments((previous) => ({
      ...previous,
      [serverId]: {
        ...target,
        services: target.services.map((service) =>
          service.id === serviceId
            ? { ...service, status: service.status === "running" ? "stopped" : "running" }
            : service,
        ),
      },
    }));
  };

  const changeServiceStartupType = (
    serverId: string,
    serviceId: string,
    startupType: RuntimeService["startupType"],
  ) => {
    const current = environments[serverId];
    if (!current) throw new Error(`Unknown server session: ${serverId}`);
    const updated = updateRuntimeServiceStartupType(current, serviceId, startupType);
    setEnvironments((previous) => ({ ...previous, [serverId]: updated }));
    if (serverId === targetApplication?.id && startupType === "automatic") {
      recordAuditEvent("verify:service-startup", true);
    }
  };

  const runScheduledTask = (serverId: string, taskId: string) => {
    const environment = environments[serverId];
    if (!environment?.tasks.some((task) => task.id === taskId)) {
      throw new Error(`Unknown scheduled task: ${taskId}`);
    }
    setTaskRuns((previous) => ({ ...previous, [taskId]: "成功" }));
    if (serverId === targetApplication?.id) recordAuditEvent("verify:task-run", true);
  };

  const installMiddleware = (serverId: string, softwareName: string) => {
    const server = scenario.assets.servers.find((item) => item.id === serverId);
    const environment = environments[serverId];
    if (!server || !environment) throw new Error(`Unknown server session: ${serverId}`);
    if (server.stage !== "target" || !server.software.includes(softwareName)) {
      throw new Error(`Scenario middleware package is not available on ${server.hostname}: ${softwareName}`);
    }
    if (environment.installedSoftware.includes(softwareName)) {
      notify(`${softwareName} は既にインストールされています。`);
      return;
    }

    const normalizedName = softwareName.toLowerCase();
    const isResin = normalizedName.startsWith("resin ");
    const isOracle = normalizedName.startsWith("oracle ");
    if (isResin && server.role !== "application") throw new Error("ResinはAPサーバーにのみインストールできます。");
    if (isOracle && server.role !== "database") throw new Error("Oracle DatabaseはDBサーバーにのみインストールできます。");
    if (isResin && !environment.installedSoftware.some((item) => item.toLowerCase().startsWith("java "))) {
      notify("Resinの前提条件が不足しています。先にJavaをインストールしてください。");
      return;
    }

    const serviceDefinition = isResin
      ? scenario.assets.services.find((service) => service.name.toLowerCase().includes("resin")
        && scenario.assets.servers.find((item) => item.id === service.serverId)?.stage === "source")
      : isOracle
        ? scenario.assets.services.find((service) => service.serverId === serverId
          && service.name.toLowerCase().startsWith("oracleservice"))
        : undefined;
    if (isResin && !serviceDefinition) throw new Error("Scenario Resin service definition is missing.");
    if (isOracle && !serviceDefinition) throw new Error(`Scenario Oracle service definition is missing for ${server.hostname}.`);
    const databaseVersion = isOracle
      ? scenario.assets.databases.find((database) => database.serverId === serverId)?.version
      : undefined;
    if (isOracle && !databaseVersion) throw new Error(`Scenario Oracle version is missing for ${server.hostname}.`);

    const addedService: RuntimeService | undefined = serviceDefinition
      ? { ...serviceDefinition, id: `${serviceDefinition.id}-${serverId}-installed`, serverId, status: "stopped" }
      : undefined;
    setEnvironments((previous) => {
      const current = previous[serverId];
      if (!current) throw new Error(`Unknown server session: ${serverId}`);
      return {
        ...previous,
        [serverId]: {
          ...current,
          installedSoftware: [...(current.installedSoftware ?? []), softwareName],
          services: addedService
            ? [...current.services.filter((service) => service.name !== addedService.name), addedService]
            : current.services,
          databaseVersion: databaseVersion ?? current.databaseVersion,
        },
      };
    });
    recordAuditEvent(`install:middleware:${serverId}:${softwareName}`);
    notify(`${softwareName} をインストールしました。サービス構成を確認してください。`);
  };

  const recordBusinessWrite = (serverId: string) => {
    const server = scenario.assets.servers.find((item) => item.id === serverId);
    const environment = environments[serverId];
    if (!server || !environment) throw new Error(`Unknown database session: ${serverId}`);
    if (server.role !== "database" || environment.databaseRole !== "primary") {
      notify("業務更新は現在のPrimary DBでのみ実行できます。");
      return;
    }
    const oracleService = environment.services.find((service) => service.name.toLowerCase().startsWith("oracleservice"));
    if (!oracleService || oracleService.status !== "running") {
      notify("現行Oracleサービスが停止しているため、業務更新を記録できません。");
      return;
    }
    const nextRevision = (environment.databaseRevision ?? 0) + 1;
    setEnvironments((previous) => {
      const current = previous[serverId];
      if (!current) throw new Error(`Unknown database session: ${serverId}`);
      const standbyId = [sourceDatabase?.id, targetDatabase?.id].find((candidateId) =>
        candidateId !== undefined
        && candidateId !== serverId
        && previous[candidateId]?.dataGuardEnabled
        && previous[candidateId]?.databaseRole === "standby",
      );
      const standby = standbyId ? previous[standbyId] : undefined;
      const nextEnvironments = {
        ...previous,
        [serverId]: { ...current, databaseRevision: (current.databaseRevision ?? 0) + 1 },
      };
      if (standby && standbyId) {
        nextEnvironments[standbyId] = { ...standby, databaseRevision: nextRevision };
      }
      return {
        ...nextEnvironments,
      };
    });
    recordAuditEvent("database:business-write");
    const standby = [sourceDatabase?.id, targetDatabase?.id].some((candidateId) =>
      candidateId !== undefined
      && candidateId !== serverId
      && environments[candidateId]?.dataGuardEnabled
      && environments[candidateId]?.databaseRole === "standby",
    );
    if (standby) recordAuditEvent("database:dataguard-sync", true);
    notify(`Primary DBに業務更新を記録しました。データ世代: ${nextRevision}${standby ? " (Data Guard standbyへ同期)" : " (行データ自体はシミュレーションされません)"}`);
  };

  const addHypothesis = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = hypothesisInput.trim();
    if (!text) return;
    setHypotheses((previous) => [...previous, { id: Date.now(), text, status: "open" }]);
    setHypothesisInput("");
  };

  const updateHypothesis = (id: number, status: HypothesisNote["status"]) => {
    setHypotheses((previous) => previous.map((note) => note.id === id ? { ...note, status } : note));
  };

  const requestAdvisorAdvice = async () => {
    setAdvisorLoading(true);
    setAdvisorFeedback("");
    try {
      const server = scenario.assets.servers.find((item) => item.id === paneServerIds[1]);
      if (!server) throw new Error(`Unknown advisor server session: ${paneServerIds[1]}`);
      const advice = await advisor.getAdvice({
        scenario,
        server,
        mode,
        recentCommands: history[server.id] ?? [],
        hypotheses,
      });
      setAdvisorFeedback(advice);
    } catch (error) {
      setAdvisorFeedback(`助言を取得できませんでした: ${error instanceof Error ? error.message : "原因不明のエラー"}`);
    } finally {
      setAdvisorLoading(false);
    }
  };

  const changePaneServer = (index: 0 | 1, serverId: string) => {
    setPaneServerIds((previous) => {
      const updated: [string, string] = [...previous];
      updated[index] = serverId;
      return updated;
    });
  };

  const hasOpenIssues = scenario.assets.servers.some((server) => {
    const environment = environments[server.id];
    return environment && getEventLog(
      server,
      scenario,
      environment,
      environments,
      dns,
      provider !== "onprem" ? cloudWorkspace.securityGroupPorts : undefined,
    ).length > 0;
  });

  const activeObjective = getModeObjective(mode, scenario.learningObjectives, completedObjectives, scenario.learningOrderByMode);
  const targetServer = targetApplication;
  const targetEnvironment = targetServer ? environments[targetServer.id] : undefined;
  const incidentCount = targetServer && targetEnvironment
    ? getEventLog(
      targetServer,
      scenario,
      targetEnvironment,
      environments,
      dns,
      provider !== "onprem" ? cloudWorkspace.securityGroupPorts : undefined,
    ).length
    : 0;
  const databaseRevisions = sourceDatabase && targetDatabase
    ? {
      source: environments[sourceDatabase.id]?.databaseRevision ?? 0,
      target: environments[targetDatabase.id]?.databaseRevision ?? 0,
    }
    : undefined;
  const auditReport = calculateAuditReport(
    scenario,
    auditEvents,
    incidentCount,
    startedAt,
    Date.now(),
    projectWorkspace,
    databaseRevisions,
  );
  const cutoverReadiness = getCutoverReadiness(
    scenario,
    auditEvents,
    projectWorkspace,
    hasOpenIssues,
    databaseRevisions,
  );
  const availableServers = getAvailableServers(scenario, provider, cloudWorkspace);
  const cloudTargets = scenario.assets.servers.filter((server) => server.stage === "target" && server.role !== "dns");
  const cloudSetupReady = provider === "onprem" || isCloudWorkspaceReady(cloudWorkspace, cloudTargets);
  const tutorialSteps = getTutorialSteps(
    scenario.tutorialSteps,
    projectWorkspace.migrationStrategy,
    provider !== "onprem",
  );
  const tutorialEvents = deriveTutorialEvents(
    auditEvents,
    scenario,
    projectWorkspace,
    cutoverReadiness,
    provider !== "onprem" && cloudSetupReady,
  );
  const tutorialProgress = getTutorialProgress(tutorialSteps, tutorialEvents);
  const modePrompt = mode === "tutorial"
    ? getTutorialInstruction(tutorialProgress.activeStep, projectWorkspace.migrationStrategy)
      || "チュートリアルの手順は完了です。作業監査レポートで結果を確認してください。"
    : mode === "beginner"
      ? activeObjective?.beginnerInstruction || "調査項目を確認しました。移行作業を続けてください。"
      : mode === "intermediate"
        ? "Windows Server 2016 から 2019 へ更改してください。OS・実行環境・DB・依存関係を調査し、構成図と移行計画にまとめてください。確認順やコマンド例は表示されません。"
        : mode === "advanced"
          ? "切替後、ログインできません。"
          : scenario.incidents.find((incident) => incident.id === expertIncidentId)?.description ?? "業務システムで障害が発生しています。ログと構成から原因を特定してください。";

  if (screen === "desktop") {
    return (
      <DesktopHome
        mode={mode}
        provider={provider}
        shortcut={desktopShortcut}
        serverId={desktopServerId}
        availableServers={availableServers}
        saved={storedSave}
        cloudWorkspace={cloudWorkspace}
        cloudSetupReady={cloudSetupReady}
        storageError={storageError}
        scenario={scenario}
        scenarios={scenarios}
        onScenarioChange={onScenarioChange}
        onModeChange={setMode}
        onProviderChange={(nextProvider) => {
          if (provider !== nextProvider) setCloudWorkspace(createInitialCloudWorkspace());
          setProvider(nextProvider);
          if (!getAvailableServers(scenario, nextProvider, cloudWorkspace).some((server) => server.id === desktopServerId)) {
            setDesktopServerId(sourceApplication?.id ?? initialPanes[0]);
          }
        }}
        onCloudWorkspaceChange={setCloudWorkspace}
        onShortcutChange={(shortcut) => {
          setDesktopShortcut(shortcut);
          if (shortcut === "dns" && dnsServer) setDesktopServerId(dnsServer.id);
          else if (shortcut === "database" && sourceDatabase) setDesktopServerId(sourceDatabase.id);
          else if (isManagerShortcut(shortcut) && sourceApplication) setDesktopServerId(sourceApplication.id);
        }}
        onServerChange={setDesktopServerId}
        onStart={() => { if (cloudSetupReady) startFreshSession(); }}
        onContinue={continueSession}
        onStartOver={() => startFreshSession(true)}
      />
    );
  }

  return (
    <div className="lab-shell">
      <header className="lab-header">
        <div className="lab-brand">
          <div className="lab-brand-icon"><Monitor size={19} /></div>
          <div><strong>SERVER<span>LAB</span></strong><small>WINDOWS MIGRATION SIMULATOR</small></div>
        </div>
        <div className="header-request">
          <span className="request-mark"><Activity size={14} /></span>
          <span><small>{mode === "tutorial" ? "AI上司 / チュートリアル" : mode === "expert" ? "障害報告" : "作業依頼"}</small><strong>{mode === "expert" ? "発生した障害を調査し、原因を特定してください。" : mode === "advanced" ? "切替後、ログインできません" : "新環境へ移行し、切替後の稼働を確認してください"}</strong></span>
        </div>
        <div className="header-actions">
          <div className={`connection-indicator ${hasOpenIssues ? "attention" : ""}`}><i />{hasOpenIssues ? "要確認" : "接続中"}</div>
          <button className={`notes-toggle ${knowledgeOpen ? "active" : ""}`} onClick={() => setKnowledgeOpen((open) => !open)}>
            <BookOpen size={15} /> 知識ノート <span>{knowledgeRecords.length}</span>
          </button>
          <button className={`notes-toggle ${projectDeskOpen ? "active" : ""}`} onClick={() => setProjectDeskOpen(true)}>
            <ClipboardList size={15} /> 案件デスク
          </button>
          <button className={`notes-toggle ${notesOpen ? "active" : ""}`} onClick={() => setNotesOpen((open) => !open)}>
            <Lightbulb size={15} /> 仮説メモ <span>{hypotheses.length}</span>
          </button>
          <button className="header-icon" onClick={() => setScreen("desktop")} title="Windowsデスクトップへ"><Monitor size={16} /></button>
          <button className="header-icon restart-button" onClick={() => startFreshSession(true)} title="最初からやり直す" aria-label="最初からやり直す"><RotateCcw size={15} /></button>
        </div>
      </header>

      <main className="lab-main">
        <div className="workspace-title">
          <div><span className="workspace-eyebrow">REMOTE CONSOLE</span><h1>サーバーセッション</h1></div>
          <div className="workspace-status"><span><i />{providerLabel(provider)} · {modeLabel(mode)}</span><span className="key-hint"><kbd>Enter</kbd> コマンドを実行</span></div>
        </div>

        <section className={`supervisor-card mode-${mode}`}>
          <div className="supervisor-avatar">{mode === "tutorial" ? "AI" : <Activity size={17} />}</div>
          <div className="supervisor-copy"><small>{mode === "tutorial" ? "AI上司 / 調査ガイド" : `${modeLabel(mode)} / 作業指示`}</small><strong>{modePrompt}</strong>
            {mode === "tutorial" && (tutorialProgress.previousStep?.explanation || guideFeedback)
              && <span className="supervisor-explanation">解説: {tutorialProgress.previousStep?.explanation || guideFeedback}</span>}
            {mode === "beginner" && guideFeedback && <span className="supervisor-explanation">解説: {guideFeedback}</span>}
            {mode !== "tutorial" && mode !== "beginner" && <>
              <button className="advisor-request-button" onClick={requestAdvisorAdvice} disabled={advisorLoading}>
                <MessageCircle size={13} />{advisorLoading ? "助言を準備中..." : "ローカル助言を依頼"}
              </button>
              {advisorFeedback && <span className="advisor-feedback" role="status">{advisorFeedback}</span>}
            </>}
          </div>
          {mode === "tutorial" && <span className="supervisor-progress">{tutorialProgress.completedCount}/{tutorialSteps.length} 手順</span>}
        </section>

        <div className="session-grid">
          {paneServerIds.map((serverId, index) => {
            const server = scenario.assets.servers.find((item) => item.id === serverId);
            const environment = environments[serverId];
            if (!server || !environment) throw new Error(`Unknown server session: ${serverId}`);
            const activeApp = activeApps[serverId];
            return (
              <ServerSession
                key={`${index}-${server.id}`}
                slot={index === 0 ? "A" : "B"}
                server={server}
                servers={availableServers}
                environment={environment}
                environments={environments}
                dns={dns}
                allowedInboundPorts={provider !== "onprem" ? cloudWorkspace.securityGroupPorts : undefined}
                dnsDraft={dnsDraft}
                scenario={scenario}
                history={history[serverId] ?? []}
                input={inputs[serverId] ?? ""}
                app={activeApps[serverId] ?? null}
                shellMode={shellModes[serverId] ?? "cmd"}
                transfer={transfer}
                migrationStrategy={projectWorkspace.migrationStrategy}
                draft={activeApp === "resinConfig"
                  ? drafts[resinConfigDraftKey(serverId)] ?? environment.configurationFiles[0]?.content ?? ""
                  : drafts[jdbcDraftKey(serverId)] ?? environment.jdbcProperties ?? ""}
                taskRuns={taskRuns}
                onServerChange={(id) => changePaneServer(index as 0 | 1, id)}
                onInputChange={(value) => setInputs((previous) => ({ ...previous, [serverId]: value }))}
                onExecute={(command) => execute(serverId, command)}
                onOpenApp={(app) => openApp(serverId, app)}
                onExport={exportAsset}
                onImport={importAsset}
                onServiceToggle={toggleService}
                onServiceStartupTypeChange={changeServiceStartupType}
                onSoftwareInstall={installMiddleware}
                onDatabaseWrite={recordBusinessWrite}
                onDnsDraftChange={setDnsDraft}
                onDnsApply={() => {
                  const addressChanged = dnsDraft.address !== dns.address;
                  const ttlLowered = dnsDraft.ttlSeconds < dns.ttlSeconds;
                  const ttlChanged = dnsDraft.ttlSeconds !== dns.ttlSeconds;
                  const latestCutoverIndex = auditEvents.reduce(
                    (latestIndex, event, index) => event.name === "dns:cutover" ? index : latestIndex,
                    -1,
                  );
                  const latestRollbackIndex = auditEvents.reduce(
                    (latestIndex, event, index) => event.name === "dns:rollback" ? index : latestIndex,
                    -1,
                  );
                  const isRollback = Boolean(addressChanged
                    && sourceApplication
                    && dnsDraft.address === sourceApplication.ipAddress
                    && latestCutoverIndex > latestRollbackIndex);
                  const ttlPrepared = !addressChanged && ttlLowered && dnsDraft.ttlSeconds <= 300;
                  const nextDns = {
                    ...dnsDraft,
                    cachedAddress: isRollback || !addressChanged || dns.ttlSeconds > 300
                      ? dns.cachedAddress
                      : dnsDraft.address,
                  };
                  setDns(nextDns);
                  setDnsDraft(nextDns);
                  if (ttlChanged && dnsDraft.ttlSeconds > 300) recordAuditEvent("dns:ttl-invalidated", true);
                  if (ttlLowered) recordAuditEvent("dns:ttl-lowered", true);
                  if (ttlPrepared) recordAuditEvent("dns:ttl-prepared", true);
                  if (isRollback && sourceApplication) {
                    setProjectWorkspace((previous) => ({ ...previous, cutoverDecision: "rollback" }));
                    recordAuditEvent("project:rollback", true);
                    recordAuditEvent("dns:rollback", true);
                    if (nextDns.cachedAddress !== sourceApplication.ipAddress) {
                      recordAuditEvent("dns:rollback-cache-stale", true);
                    }
                    notify(`DNSを現行AP ${sourceApplication.hostname} に戻しました。クライアントキャッシュは ${nextDns.cachedAddress} のままです。`);
                  } else if (addressChanged && nextDns.address === targetApplication?.ipAddress) {
                    const latestRollbackIndex = auditEvents.reduce(
                      (latestIndex, event, index) => event.name === "dns:rollback" ? index : latestIndex,
                      -1,
                    );
                    const decisionRecordedForCycle = auditEvents.some((event, index) =>
                      index > latestRollbackIndex
                      && (event.name === "project:decision:go" || event.name === "project:decision:no-go"),
                    );
                    if (!decisionRecordedForCycle) {
                      setProjectWorkspace((previous) => ({ ...previous, cutoverDecision: "pending" }));
                    }
                    recordAuditEvent("dns:cutover", true);
                    if (ttlLowered) recordAuditEvent("dns:ttl-lowered-during-cutover", true);
                    if (nextDns.cachedAddress !== nextDns.address) recordAuditEvent("dns:cutover-cache-stale", true);
                    notify("DNSを新APへ切り替えました。nslookupとHTTP疎通でキャッシュ状態を確認してください。");
                  } else {
                    notify("DNSレコードを適用しました。切替後はnslookupとHTTP疎通でキャッシュ状態を確認してください。");
                  }
                }}
                onJdbcChange={(value) => {
                  const key = activeApp === "resinConfig" ? resinConfigDraftKey(serverId) : jdbcDraftKey(serverId);
                  setDrafts((previous) => ({ ...previous, [key]: value }));
                }}
                onJdbcSave={(content) => {
                  setDrafts((previous) => ({ ...previous, [jdbcDraftKey(serverId)]: content }));
                  setEnvironments((previous) => ({
                    ...previous,
                    [serverId]: { ...previous[serverId], jdbcProperties: content },
                  }));
                  const targetDatabaseInfo = targetDatabase && scenario.assets.databases.find((database) => database.serverId === targetDatabase.id);
                  const targetConfigured = Boolean(serverId === targetApplication?.id
                    && targetDatabase
                    && targetDatabaseInfo
                    && jdbcPropertiesTargetDatabase(content, targetDatabase, targetDatabaseInfo));
                  if (targetConfigured) {
                    recordAuditEvent("migrate:jdbc");
                  }
                  notify(targetConfigured
                    ? "jdbc.properties を保存しました。DBSV02への接続設定を確認しました。"
                    : serverId === targetApplication?.id && targetDatabase && targetDatabaseInfo
                      ? `保存しました。jdbc.urlを ${targetDatabase.hostname}:${targetDatabaseInfo.listenerPort}:${targetDatabaseInfo.serviceName} に合わせてください。`
                      : "jdbc.properties を保存しました");
                }}
                onConfigSave={(content) => {
                  setEnvironments((previous) => {
                    const current = previous[serverId];
                    if (!current) throw new Error(`Unknown server session: ${serverId}`);
                    const template = scenario.assets.configurationFiles.find((file) => file.name === "resin.conf");
                    if (!template) throw new Error("シナリオに resin.conf がありません。");
                    const config = current.configurationFiles[0]
                      ? { ...current.configurationFiles[0], content }
                      : { ...template, serverId, content };
                    return { ...previous, [serverId]: { ...current, configurationFiles: [config] } };
                  });
                  setDrafts((previous) => ({ ...previous, [resinConfigDraftKey(serverId)]: content }));
                  notify("resin.conf を保存しました");
                }}
                onTaskRun={(taskId) => runScheduledTask(serverId, taskId)}
                onNotify={notify}
                onCloseApp={() => openApp(serverId, null)}
              />
            );
          })}
        </div>

        <section className="lab-guidance">
          <div className="guidance-icon"><LockKeyhole size={15} /></div>
          <div><strong>接続先の設定やサービス構成は、コマンドと管理ツールで確認してください。</strong><span>左右の接続先は独立して操作できます。両方で同じツールを開き、結果を比較できます。</span></div>
          <span className="guidance-hint">TIP <ArrowDownToLine size={13} /></span>
        </section>

        {knowledgeOpen && (
          <section className="knowledge-panel">
            <div className="hypothesis-heading"><div className="hypothesis-icon"><BookOpen size={16} /></div><div><h2>知識ノート</h2><p>実行した調査コマンドから、確認する理由を記録します。</p></div><button className="close-notes" onClick={() => setKnowledgeOpen(false)} aria-label="知識ノートを閉じる"><X size={16} /></button></div>
            {knowledgeRecords.length === 0 ? <p className="empty-notes">調査結果はまだありません。systeminfo や java -version を実行すると、確認目的が記録されます。</p> : <div className="knowledge-list">{knowledgeRecords.map((record) => <article className="knowledge-item" key={`${record.id}:${record.serverId}`}><strong>{record.title}</strong><small>{record.serverId}</small><p>{record.explanation}</p></article>)}</div>}
          </section>
        )}

        {notesOpen && (
          <section className="hypothesis-panel">
            <div className="hypothesis-heading"><div className="hypothesis-icon"><Lightbulb size={17} /></div><div><h2>調査メモ</h2><p>気づいた相違点や、障害の原因についての仮説を記録します。</p></div><button className="close-notes" onClick={() => setNotesOpen(false)} aria-label="メモを閉じる"><X size={16} /></button></div>
            <form className="hypothesis-form" onSubmit={addHypothesis}><input value={hypothesisInput} onChange={(event) => setHypothesisInput(event.target.value)} placeholder="例: 新サーバーのJDBC接続先は旧DBのままではないか？" /><button type="submit" disabled={!hypothesisInput.trim()}>仮説を記録</button></form>
            {hypotheses.length === 0 ? <p className="empty-notes">まだメモはありません。調査で気づいたことを書き留めてください。</p> : <div className="hypothesis-list">{hypotheses.map((note) => <div className="hypothesis-item" key={note.id}><span className={`hypothesis-state ${note.status}`}>{note.status === "open" ? "未検証" : note.status === "confirmed" ? "確認" : "棄却"}</span><p>{note.text}</p><div className="hypothesis-actions"><button onClick={() => updateHypothesis(note.id, "confirmed")}>確認できた</button><button onClick={() => updateHypothesis(note.id, "rejected")}>仮説を棄却</button></div></div>)}</div>}
          </section>
        )}

        <div className="completion-bar"><span><Shield size={13} />操作はシミュレーション内だけで実行され、自動保存されます。</span><button className="completion-button" onClick={() => setReportOpen(true)}><CheckCircle2 size={15} />作業完了 / 監査レポート</button></div>
        {storageError && <p className="storage-warning" role="status">セーブエラー: {storageError}</p>}
        <footer className="lab-footer"><span>WINDOWS SERVER LAB <i /> {scenario.title}</span><button onClick={() => setScreen("desktop")}>Windowsデスクトップ</button></footer>
      </main>
      {notice && <div className="notice-toast"><Check size={15} />{notice}<button onClick={() => setNotice("")} aria-label="通知を閉じる"><X size={14} /></button></div>}
      {projectDeskOpen && <ProjectDeskModal
        scenario={scenario}
        project={projectWorkspace}
        dnsAddress={dns.address}
        cachedDnsAddress={dns.cachedAddress}
        sourceAddress={sourceApplication?.ipAddress ?? ""}
        targetAddress={targetApplication?.ipAddress ?? ""}
        hasOpenIssues={hasOpenIssues}
        readinessItems={cutoverReadiness}
        onChange={setProjectWorkspace}
        onSendNotice={sendUserNotice}
        onDecision={recordCutoverDecision}
        onRollback={rollbackCutover}
        onClose={() => setProjectDeskOpen(false)}
      />}
      {reportOpen && <AuditReportModal report={auditReport} onClose={() => setReportOpen(false)} onRestart={() => startFreshSession(true)} />}
    </div>
  );
}

function DesktopHome({
  mode,
  provider,
  shortcut,
  serverId,
  availableServers,
  saved,
  cloudWorkspace,
  cloudSetupReady,
  storageError,
  scenario,
  scenarios,
  onModeChange,
  onProviderChange,
  onCloudWorkspaceChange,
  onShortcutChange,
  onServerChange,
  onScenarioChange,
  onStart,
  onContinue,
  onStartOver,
}: {
  mode: DifficultyMode;
  provider: DeploymentProvider;
  shortcut: DesktopShortcut;
  serverId: string;
  availableServers: Server[];
  saved: SimulationSave | null;
  cloudWorkspace: CloudWorkspace;
  cloudSetupReady: boolean;
  storageError: string | null;
  scenario: Scenario;
  scenarios: Scenario[];
  onModeChange: (mode: DifficultyMode) => void;
  onProviderChange: (provider: DeploymentProvider) => void;
  onCloudWorkspaceChange: (workspace: CloudWorkspace) => void;
  onShortcutChange: (shortcut: DesktopShortcut) => void;
  onServerChange: (serverId: string) => void;
  onScenarioChange: (scenarioId: string) => void;
  onStart: () => void;
  onContinue: () => void;
  onStartOver: () => void;
}) {
  const shortcuts: Array<{ id: DesktopShortcut; label: string; icon: React.ReactNode }> = [
    { id: "explorer", label: "エクスプローラー", icon: <FolderOpen size={22} /> },
    { id: "cmd", label: "CMD", icon: <Terminal size={22} /> },
    { id: "powershell", label: "PowerShell", icon: <Power size={22} /> },
    { id: "services", label: "services.msc", icon: <Settings size={22} /> },
    { id: "tasks", label: "taskschd.msc", icon: <ListTodo size={22} /> },
    { id: "events", label: "イベント ビューアー", icon: <FileText size={22} /> },
    { id: "certificates", label: "証明書", icon: <FileKey2 size={22} /> },
    { id: "database", label: "SQL*Plus", icon: <Database size={22} /> },
    { id: "dns", label: "DNS マネージャー", icon: <Network size={22} /> },
    { id: "resinConfig", label: "resin.conf", icon: <FileText size={22} /> },
  ];
  const selectedLabel = shortcuts.find((item) => item.id === shortcut)?.label ?? "CMD";
  const targetServers = scenario.assets.servers.filter((server) => server.stage === "target" && server.role !== "dns");
  const targetIps = targetServers.map((server) => `${server.hostname} ${server.ipAddress}`).join(" / ");
  const targetNetwork = targetServers[0]?.ipAddress.split(".") ?? ["10", "10", "2", "0"];
  const exampleVpc = `${targetNetwork[0]}.${targetNetwork[1]}.0.0/16`;
  const exampleSubnet = `${targetNetwork[0]}.${targetNetwork[1]}.${targetNetwork[2]}.0/24`;
  const modeDescriptions: Record<DifficultyMode, string> = {
    tutorial: "AI上司が手順を案内し、実行後に確認目的を解説します。",
    beginner: "達成する目的だけを表示します。調査方法は自分で考えます。",
    intermediate: "更改の目的だけを提示します。構成図やヒントはありません。",
    advanced: "障害の症状だけを提示します。ログと構成から原因を特定してください。",
    expert: "移行済み環境に障害が1件発生します。事象だけが提示され、調査・復旧方法は案内されません。",
  };
  const selectedServer = availableServers.find((server) => server.id === serverId);

  return (
    <main className="windows-desktop">
      <div className="desktop-wallpaper">
        <div className="desktop-icons">
          {shortcuts.map((item) => (
            <button className={`desktop-icon ${shortcut === item.id ? "selected" : ""}`} key={item.id} onClick={() => onShortcutChange(item.id)}>
              <span>{item.icon}</span><small>{item.label}</small>
            </button>
          ))}
          <button className="desktop-icon recycle-icon" onClick={() => onShortcutChange("explorer")}><span>♲</span><small>ごみ箱</small></button>
        </div>

        {(provider === "aws" || provider === "azure") && <AwsConsole
          provider={provider}
          servers={scenario.assets.servers}
          workspace={cloudWorkspace}
          onChange={onCloudWorkspaceChange}
          onConnect={(targetId) => { onServerChange(targetId); onShortcutChange("cmd"); }}
        />}

        <section className="desktop-connect-window">
          <div className="desktop-window-title"><div><Monitor size={15} /><strong>Windows Server Migration Lab</strong></div><span>─　□　×</span></div>
          <div className="desktop-connect-content">
            <div className="desktop-connect-heading"><div className="desktop-logo"><Monitor size={24} /></div><div><h1>リモート デスクトップ接続</h1><p>調査から切替・障害対応までをサーバー操作で体験します。</p></div></div>
            <label className="desktop-setting-row"><span>案件</span><select value={scenario.id} onChange={(event) => onScenarioChange(event.target.value)}>{scenarios.map((item) => <option value={item.id} key={item.id}>{item.title}</option>)}</select></label>
            <label className="desktop-setting-row"><span>基盤</span><select value={provider} onChange={(event) => onProviderChange(event.target.value as DeploymentProvider)}><option value="onprem">オンプレミス</option><option value="aws">AWS</option><option value="azure">Azure</option></select></label>
            <label className="desktop-setting-row"><span>接続先</span><select value={selectedServer?.id ?? availableServers[0]?.id ?? ""} onChange={(event) => onServerChange(event.target.value)}>{availableServers.map((server) => <option value={server.id} key={server.id}>{server.hostname} — {server.role}</option>)}</select></label>
            <label className="desktop-setting-row"><span>難易度</span><select value={mode} onChange={(event) => onModeChange(event.target.value as DifficultyMode)}><option value="tutorial">チュートリアル</option><option value="beginner">初級</option><option value="intermediate">中級</option><option value="advanced">上級</option><option value="expert">エキスパート</option></select></label>
            <div className="mode-description"><strong>{modeLabel(mode)}</strong><span>{modeDescriptions[mode]}</span></div>
            {mode === "tutorial" && provider !== "onprem" && <section className="cloud-start-tutorial" aria-labelledby="cloud-start-tutorial-title">
              <strong id="cloud-start-tutorial-title">開始前に {provider === "aws" ? "AWS" : "Azure"} 基盤を準備します</strong>
              <p>右上のクラウド画面で、上から順に設定してください。これは学習用の疑似環境で、実クラウドには接続しません。</p>
              <ol>
                <li><b>ネットワーク</b>: {exampleVpc} を作成し、次に {exampleSubnet} のサブネットを作成します。移行先の固定IPがこの範囲に入る必要があります。</li>
                <li><b>ファイアウォール</b>: ファイアウォールタブで TCP 3389 (RDP)、8080 (AP疎通)、1521 (Oracle接続) を許可します。実環境では接続元を必要な範囲に制限してください。</li>
                <li><b>VM起動</b>: VMタブで対象を1台ずつ起動します。{targetIps} の{targetServers.length}台が起動し、必要な通信ルールがそろうと開始できます。</li>
              </ol>
              <p className="cloud-start-why">ネットワーク → 通信許可 → サーバーの順に作るのは、VMが使うIP範囲と接続経路を先に確定するためです。</p>
            </section>}
            <div className="selected-shortcut"><span className="shortcut-window-icon"><Terminal size={17} /></span><div><small>デスクトップ アプリ / 接続先</small><strong>{selectedLabel} → {selectedServer?.hostname ?? availableServers[0]?.hostname}</strong></div><span className="rdp-target">{provider === "aws" ? "EC2 / RDP" : provider === "azure" ? "Azure VM / RDP" : "RDP / Windows Server"}</span></div>
            <div className="desktop-connect-actions">
              {saved && <button className="desktop-continue" onClick={onContinue}><Play size={14} />続きから始める</button>}
              <button className="desktop-start" disabled={!cloudSetupReady} onClick={onStart}><ArrowRight size={15} />{saved ? "最初から開始" : "RDP接続して開始"}</button>
            </div>
            {!cloudSetupReady && provider !== "onprem" && <p className="cloud-start-blocked" role="status">クラウド基盤の構築が完了すると開始できます。VMタブで起動状態を、ファイアウォールタブで必要ポートを確認してください。</p>}
            {storageError && <p className="storage-warning" role="status">セーブデータ: {storageError}</p>}
            <p className="desktop-safety"><LockKeyhole size={12} />このアプリ内の疑似環境です。実サーバーやクラウドへ接続しません。</p>
          </div>
        </section>

        <div className="desktop-selection-hint"><strong>{selectedLabel}</strong><span>を選択中 — 接続後に対応する疑似アプリを開きます</span></div>
        {saved && <button className="desktop-reset" onClick={onStartOver}><RotateCcw size={12} />保存状態を破棄</button>}
        <div className="windows-taskbar"><button className="taskbar-start-mark" title="スタート">⊞</button><span className="taskbar-search">検索</span><span className="taskbar-open-app"><Monitor size={14} /> Migration Lab</span><span className="taskbar-clock">11:14　2026/11/12</span></div>
      </div>
    </main>
  );
}

function ProjectDeskModal({
  scenario,
  project,
  dnsAddress,
  cachedDnsAddress,
  sourceAddress,
  targetAddress,
  hasOpenIssues,
  readinessItems,
  onChange,
  onSendNotice,
  onDecision,
  onRollback,
  onClose,
}: {
  scenario: Scenario;
  project: ProjectWorkspace;
  dnsAddress: string;
  cachedDnsAddress: string;
  sourceAddress: string;
  targetAddress: string;
  hasOpenIssues: boolean;
  readinessItems: CutoverReadinessItem[];
  onChange: (project: ProjectWorkspace) => void;
  onSendNotice: () => void;
  onDecision: (decision: ProjectWorkspace["cutoverDecision"]) => void;
  onRollback: () => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"overview" | "investigation" | "plan" | "cutover">("overview");
  const [noteTitle, setNoteTitle] = useState("");
  const [noteDetail, setNoteDetail] = useState("");
  const [edgeFrom, setEdgeFrom] = useState("");
  const [edgeTo, setEdgeTo] = useState("");
  const update = (patch: Partial<ProjectWorkspace>) => onChange({ ...project, ...patch });

  const addNote = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = noteTitle.trim();
    const detail = noteDetail.trim();
    if (!title || !detail) return;
    update({
      investigationNotes: [...project.investigationNotes, {
        id: `${Date.now()}`,
        title,
        detail,
        createdAt: Date.now(),
      }],
    });
    setNoteTitle("");
    setNoteDetail("");
  };

  const addEdge = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const from = edgeFrom.trim();
    const to = edgeTo.trim();
    if (!from || !to || from === to) return;
    update({ architectureEdges: [...project.architectureEdges, { id: `${Date.now()}`, from, to }] });
    setEdgeFrom("");
    setEdgeTo("");
  };

  const tabs: Array<{ id: typeof tab; label: string }> = [
    { id: "overview", label: "案件概要" },
    { id: "investigation", label: "調査・構成" },
    { id: "plan", label: "計画・周知" },
    { id: "cutover", label: "切替判断" },
  ];

  return (
    <div className="report-backdrop" role="presentation">
      <section className="audit-report project-desk" role="dialog" aria-modal="true" aria-labelledby="project-desk-title">
        <header className="report-header">
          <div><small>PROJECT CONTROL DESK</small><h2 id="project-desk-title">案件デスク</h2></div>
          <button onClick={onClose} aria-label="案件デスクを閉じる"><X size={17} /></button>
        </header>
        <nav className="project-tabs" aria-label="案件デスクの項目">
          {tabs.map((item) => <button className={tab === item.id ? "active" : ""} key={item.id} onClick={() => setTab(item.id)}>{item.label}</button>)}
        </nav>

        {tab === "overview" && <div className="project-tab-content">
          <p className="project-intro">{scenario.title} — 技術作業に加え、調査・設計・周知・切替判断を記録します。入力内容は自動保存されます。</p>
          <div className="project-brief-grid">
            <article><small>利用者数</small><strong>{scenario.project.users.toLocaleString()} 人</strong></article>
            <article><small>許容停止時間</small><strong>{scenario.project.downtimeLimitMinutes} 分</strong></article>
            <article><small>計画停止枠</small><strong>{scenario.project.downtimeWindow}</strong></article>
            <article><small>重要度</small><strong>{scenario.project.criticality}</strong></article>
          </div>
          <div className="project-section">
            <h3>案件スコープ</h3>
            <div className="project-chip-list">{scenario.project.components.map((component) => <span key={component}>{component}</span>)}</div>
            <p>構成図は「調査・構成」で調査結果をもとに作成します。ここでは正解の接続関係を表示しません。</p>
          </div>
          <div className="project-section">
            <h3>現在の作業記録</h3>
            <p>調査メモ {project.investigationNotes.length} 件 · 構成図 {project.architectureEdges.length} 接続 · 周知 {project.noticeSent ? "送信済み" : "未送信"}</p>
            <p>切替判断: {cutoverDecisionLabel(project.cutoverDecision)}</p>
          </div>
        </div>}

        {tab === "investigation" && <div className="project-tab-content project-columns">
          <section className="project-section">
            <h3>調査ノート</h3>
            <p>コマンドや管理ツールで得た事実、確認元、移行上の意味を記録します。</p>
            <form className="project-form" onSubmit={addNote}>
              <label>見出し<input value={noteTitle} onChange={(event) => setNoteTitle(event.target.value)} placeholder="例: APSV01のJavaバージョン" /></label>
              <label>調査結果・判断根拠<textarea value={noteDetail} onChange={(event) => setNoteDetail(event.target.value)} rows={3} placeholder="確認した値、確認したサーバー、移行時に必要な対応を記録" /></label>
              <button className="project-primary-button" type="submit" disabled={!noteTitle.trim() || !noteDetail.trim()}>調査ノートを保存</button>
            </form>
            {project.investigationNotes.length === 0
              ? <p className="project-empty">保存した調査ノートはありません。</p>
              : <div className="project-record-list">{project.investigationNotes.map((note) => <article key={note.id}><div><strong>{note.title}</strong><button onClick={() => update({ investigationNotes: project.investigationNotes.filter((item) => item.id !== note.id) })} aria-label={`${note.title}を削除`}><X size={13} /></button></div><p>{note.detail}</p></article>)}</div>}
          </section>
          <section className="project-section">
            <h3>構成図の接続を記録</h3>
            <p>調査で確認した接続元・接続先を入力します。シナリオに定義された依存関係との一致は監査レポートで評価します。</p>
            <form className="project-form project-edge-form" onSubmit={addEdge}>
              <label>接続元<input list="project-components" value={edgeFrom} onChange={(event) => setEdgeFrom(event.target.value)} placeholder="例: APサーバ" /></label>
              <label>接続先<input list="project-components" value={edgeTo} onChange={(event) => setEdgeTo(event.target.value)} placeholder="例: Oracle DB" /></label>
              <datalist id="project-components">{scenario.project.components.map((component) => <option value={component} key={component} />)}</datalist>
              <button className="project-primary-button" type="submit" disabled={!edgeFrom.trim() || !edgeTo.trim() || edgeFrom.trim() === edgeTo.trim()}>接続を追加</button>
            </form>
            {project.architectureEdges.length === 0
              ? <p className="project-empty">構成図に記録した接続はありません。</p>
              : <div className="project-edge-list">{project.architectureEdges.map((edge) => <div key={edge.id}><span>{edge.from}</span><ArrowRight size={14} /><span>{edge.to}</span><button onClick={() => update({ architectureEdges: project.architectureEdges.filter((item) => item.id !== edge.id) })} aria-label={`${edge.from}から${edge.to}の接続を削除`}><X size={13} /></button></div>)}</div>}
          </section>
        </div>}

        {tab === "plan" && <div className="project-tab-content project-columns">
          <section className="project-section">
            <h3>移行・停止計画</h3>
            <div className="project-form">
              <label>作業時間帯<input value={project.maintenanceWindow} onChange={(event) => update({ maintenanceWindow: event.target.value })} placeholder={scenario.project.downtimeWindow} /></label>
              <label>計画停止時間 (分)<input type="number" min={0} value={project.plannedDowntimeMinutes} onChange={(event) => update({ plannedDowntimeMinutes: Math.max(0, Number(event.target.value)) })} /></label>
              <label>DB移行方式<select value={project.migrationStrategy} onChange={(event) => {
                const strategy = event.target.value;
                if (strategy === "expdp" || strategy === "rman" || strategy === "dataguard") update({ migrationStrategy: strategy });
              }}>
                <option value="expdp">EXPDP / IMPDP — 停止後に差分同期が必要</option>
                <option value="rman">RMAN — バックアップ・リストア</option>
                <option value="dataguard">Data Guard — 同期後に切替</option>
              </select></label>
              <label>切替何日前にTTL短縮するか<input type="number" min={0} value={project.ttlLeadDays} onChange={(event) => update({ ttlLeadDays: Math.max(0, Number(event.target.value)) })} /></label>
              <label>切替何日前に利用者へ周知するか<input type="number" min={0} value={project.noticeLeadDays} onChange={(event) => update({ noticeLeadDays: Math.max(0, Number(event.target.value)) })} /></label>
              <label>切戻し手順・判断条件<textarea rows={4} value={project.rollbackPlan} onChange={(event) => update({ rollbackPlan: event.target.value })} placeholder="例: 23:30までにログイン確認できない場合、DNSを旧APへ戻し、旧AP/DBは翌営業日まで維持する。" /></label>
            </div>
            <p className="project-plan-note">選択した方式はDBサーバーの端末コマンドに反映されます。Data Pumpはexpdp / impdp、RMANは rman backup / rman restore、Data Guardは dgmgrl prepare / dgmgrl start standby / dgmgrl switchover を実行してください。</p>
            <p className="project-plan-note">TTL短縮は切替3日前以上に計画し、DNSマネージャーでTTLだけを先に適用してください。シミュレーションでは待機完了として扱いますが、計画日数とTTL適用の作業順は監査レポートで別々に確認します。</p>
            <p className={`project-limit-note ${project.plannedDowntimeMinutes > scenario.project.downtimeLimitMinutes ? "warning" : ""}`}>
              許容停止時間: {scenario.project.downtimeLimitMinutes} 分 · 現在の計画: {project.plannedDowntimeMinutes} 分
            </p>
          </section>
          <section className="project-section">
            <h3>利用者周知</h3>
            <p>停止日時・対象業務・利用者への影響を記載し、周知記録を残します。</p>
            <div className="project-form">
              <label>件名<input value={project.noticeSubject} onChange={(event) => update({ noticeSubject: event.target.value, noticeSent: false })} /></label>
              <label>本文<textarea rows={6} value={project.noticeBody} onChange={(event) => update({ noticeBody: event.target.value, noticeSent: false })} /></label>
            </div>
            <button className="project-primary-button" onClick={onSendNotice} disabled={!project.noticeSubject.trim() || !project.noticeBody.trim()}>
              {project.noticeSent ? "周知を再送信" : "周知を送信した記録を残す"}
            </button>
            {project.noticeSent && <p className="project-success">利用者周知は送信済みとして記録されています。</p>}
          </section>
        </div>}

        {tab === "cutover" && <div className="project-tab-content">
          <div className="project-cutover-status">
            <div><small>DNS現在値</small><strong>{dnsAddress}</strong></div>
            <div><small>切替先</small><strong>{targetAddress || "シナリオ未定義"}</strong></div>
            <div><small>障害状態</small><strong className={hasOpenIssues ? "project-risk" : "project-safe"}>{hasOpenIssues ? "要確認" : "現在の検出なし"}</strong></div>
          </div>
          <p>クライアントDNSキャッシュ: <strong>{cachedDnsAddress}</strong>{cachedDnsAddress !== dnsAddress && " — DNS現在値と異なります。ipconfig /flushdns 後に再確認してください。"}</p>
          <div className="cutover-readiness" aria-label="切替前チェックリスト">
            <div className="cutover-readiness-heading">
              <h3>切替前チェックリスト</h3>
              <strong>{readinessItems.filter((item) => item.ready).length}/{readinessItems.length} 完了</strong>
            </div>
            <ul>{readinessItems.map((item) => <li className={item.ready ? "ready" : "pending"} key={item.id}>
              <span>{item.ready ? <Check size={14} /> : <AlertCircle size={14} />}</span>
              <div><strong>{item.title}</strong>{!item.ready && <small>{item.detail}</small>}</div>
            </li>)}</ul>
          </div>
          <div className="project-section">
            <h3>Go / No-Go判定</h3>
            <p>チェックリストの未完了項目はGo判定時にも通知され、監査レポートに記録されます。Go/No-Goは作業判断の記録で、DNS操作自体はDNSマネージャーから実施します。</p>
            <div className="project-decision-actions">
              <button className="project-primary-button" onClick={() => onDecision("go")}>Go — 切替を進める</button>
              <button className="project-secondary-button" onClick={() => onDecision("no-go")}>No-Go — 切替を中止</button>
              {dnsAddress === targetAddress && <button className="project-secondary-button" onClick={onRollback}>DNSを現行APへ切り戻す</button>}
              {dnsAddress === targetAddress && <button className="project-secondary-button" onClick={() => onDecision("continue")}>障害を許容して継続</button>}
            </div>
            <p>現在の判定: <strong>{cutoverDecisionLabel(project.cutoverDecision)}</strong></p>
            {project.cutoverDecision === "rollback" && <p className="project-success">DNSを旧APへ戻しました。各クライアントのDNSキャッシュも確認してください。</p>}
          </div>
          <div className="project-section project-risk-note">
            <h3>実施時の注意</h3>
            <p>DNS切替だけでは、新APの疎通・DB接続・認証・バッチ処理は保証されません。切替前後の確認結果と、切戻し判断の期限を記録してください。</p>
            {sourceAddress && <small>現行AP: {sourceAddress}</small>}
          </div>
        </div>}

        <footer className="report-actions"><span>変更はこのブラウザーに自動保存されます。</span><button onClick={onClose}>案件デスクを閉じる</button></footer>
      </section>
    </div>
  );
}

function cutoverDecisionLabel(decision: ProjectWorkspace["cutoverDecision"]): string {
  const labels: Record<ProjectWorkspace["cutoverDecision"], string> = {
    pending: "未判定",
    go: "Go — 切替可",
    "no-go": "No-Go — 切替中止",
    rollback: "切戻し実施",
    continue: "障害を許容して継続",
  };
  return labels[decision];
}

function AuditReportModal({
  report,
  onClose,
  onRestart,
}: {
  report: ReturnType<typeof calculateAuditReport>;
  onClose: () => void;
  onRestart: () => void;
}) {
  return (
    <div className="report-backdrop" role="presentation">
      <section className="audit-report" role="dialog" aria-modal="true" aria-labelledby="audit-report-title">
        <header className="report-header"><div><small>SIMULATION REVIEW</small><h2 id="audit-report-title">移行監査レポート</h2></div><button onClick={onClose} aria-label="レポートを閉じる"><X size={17} /></button></header>
        <div className="report-metrics">
          <div><small>移行成功率</small><strong>{report.successRate}%</strong></div>
          <div><small>推定停止時間</small><strong>{report.estimatedDowntimeMinutes} 分</strong></div>
          <div><small>障害件数</small><strong>{report.incidentCount} 件</strong></div>
          <div><small>復旧時間</small><strong>{report.recoveryMinutes === null ? "未復旧" : `${report.recoveryMinutes} 分`}</strong></div>
          <div><small>作業時間</small><strong>{report.elapsedMinutes} 分</strong></div>
        </div>
        <section className="report-quality">
          <div className="report-quality-heading"><h3>案件品質評価</h3><strong>総合評価: {report.overallGrade}</strong></div>
          <div className="report-quality-grid">{report.projectScores.map((item) => <article key={item.id}><small>{item.label}</small><strong>{item.score}<span>点</span></strong></article>)}</div>
        </section>
        {report.projectFindings.length > 0 && <section className="report-findings">
          <h3>案件運営の改善項目</h3>
          {report.projectFindings.map((finding) => <article key={finding.id}><strong>{finding.title}</strong><p>修正方法: {finding.remediation}</p></article>)}
        </section>}
        <div className="report-checklist"><h3>作業監査</h3>{report.checks.map(({ check, complete, missingOperations }) => <article className={`report-check ${complete ? "complete" : "missing"}`} key={check.id}><span>{complete ? <CheckCircle2 size={15} /> : <X size={15} />}</span><div><strong>{check.title}</strong>{!complete && <><small>未実施の操作: {missingOperations.join(" / ")}</small><small>修正方法: {check.remediation}</small><small>想定影響: {check.impact}</small></>}</div></article>)}</div>
        {report.orderWarnings.length > 0 && <div className="report-order"><strong>手順レビュー</strong>{report.orderWarnings.map((warning) => <p key={warning}>{warning}</p>)}</div>}
        <div className="report-ai-review"><strong><Activity size={14} />AIレビュー (ローカル評価)</strong><p>{report.review}</p><small>外部生成AIへの接続はありません。レビュー規則は後からAIアドバイザーに置き換えられます。</small></div>
        <footer className="report-actions"><button onClick={onClose}>作業に戻る</button><button className="desktop-start" onClick={onRestart}><RotateCcw size={14} />最初からやり直す</button></footer>
      </section>
    </div>
  );
}

function ServerSession({
  slot,
  server,
  servers,
  environment,
  environments,
  dns,
  allowedInboundPorts,
  dnsDraft,
  scenario,
  history,
  input,
  app,
  shellMode,
  transfer,
  migrationStrategy,
  draft,
  taskRuns,
  onServerChange,
  onInputChange,
  onExecute,
  onOpenApp,
  onExport,
  onImport,
  onServiceToggle,
  onServiceStartupTypeChange,
  onSoftwareInstall,
  onDatabaseWrite,
  onDnsDraftChange,
  onDnsApply,
  onJdbcChange,
  onJdbcSave,
  onConfigSave,
  onTaskRun,
  onNotify,
  onCloseApp,
}: {
  slot: string;
  server: Server;
  servers: Server[];
  environment: RuntimeEnvironment;
  environments: RuntimeEnvironments;
  dns: DnsRuntime;
  allowedInboundPorts?: number[];
  dnsDraft: DnsRuntime;
  scenario: Scenario;
  history: ConsoleEntry[];
  input: string;
  app: ManagerApp | null;
  shellMode: ShellMode;
  transfer: TransferPackage | null;
  migrationStrategy: DatabaseMigrationStrategy;
  draft: string;
  taskRuns: Record<string, string>;
  onServerChange: (id: string) => void;
  onInputChange: (value: string) => void;
  onExecute: (command: string) => void;
  onOpenApp: (app: ManagerApp) => void;
  onExport: (serverId: string, kind: TransferPackage["kind"], content?: string) => void;
  onImport: (serverId: string) => void;
  onServiceToggle: (serverId: string, serviceId: string) => void;
  onServiceStartupTypeChange: (serverId: string, serviceId: string, startupType: RuntimeService["startupType"]) => void;
  onSoftwareInstall: (serverId: string, softwareName: string) => void;
  onDatabaseWrite: (serverId: string) => void;
  onDnsDraftChange: (dns: DnsRuntime) => void;
  onDnsApply: () => void;
  onJdbcChange: (value: string) => void;
  onJdbcSave: (content: string) => void;
  onConfigSave: (content: string) => void;
  onTaskRun: (taskId: string) => void;
  onNotify: (message: string) => void;
  onCloseApp: () => void;
}) {
  const issueEvents = getEventLog(server, scenario, environment, environments, dns, allowedInboundPorts);
  const sourceDatabase = scenario.assets.servers.find((item) => item.role === "database" && item.stage === "source");
  const sourceDatabaseRevision = sourceDatabase ? environments[sourceDatabase.id]?.databaseRevision ?? 0 : 0;
  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onExecute(input);
  };

  return (
    <section className={`server-session ${slot === "B" ? "target-session" : ""}`}>
      <div className="session-caption">
        <div className={`session-slot ${slot === "B" ? "blue" : ""}`}><ServerIcon size={14} />{slot}</div>
        <div className="server-name"><strong>{server.hostname}</strong><span>Administrator · 接続中</span></div>
        <label className="server-picker"><span>接続先</span><select value={server.id} onChange={(event) => onServerChange(event.target.value)} aria-label={`${slot}側の接続先`}>{servers.map((item) => <option value={item.id} key={item.id}>{item.hostname}</option>)}</select><ChevronDown size={13} /></label>
      </div>
      <div className="machine-window">
        <div className="machine-titlebar"><div className="titlebar-product"><span className="windows-mark">⊞</span><span>{app ? managerTitle(app) : shellMode === "powershell" ? "Administrator: Windows PowerShell" : "Administrator: Command Prompt"}</span></div><div className="window-controls"><button aria-label="最小化">─</button><button aria-label="最大化">□</button><button className="window-close" aria-label="閉じる" onClick={onCloseApp}><X size={13} /></button></div></div>
        <div className="app-quickbar" aria-label="Windows管理ツール">
          <button className={app === "explorer" ? "quick-active" : ""} onClick={() => onOpenApp("explorer")} title="エクスプローラー"><FolderOpen size={14} /><span>Explorer</span></button>
          <button className={app === "services" ? "quick-active" : ""} onClick={() => onOpenApp("services")} title="サービス管理"><Settings size={14} /><span>サービス</span></button>
          {server.stage === "target" && <button className={app === "setup" ? "quick-active" : ""} onClick={() => onOpenApp("setup")} title="ソフトウェア構成"><HardDrive size={14} /><span>セットアップ</span></button>}
          <button className={app === "tasks" ? "quick-active" : ""} onClick={() => onOpenApp("tasks")} title="タスク スケジューラ"><ListTodo size={14} /><span>タスク</span></button>
          <button className={app === "certificates" ? "quick-active" : ""} onClick={() => onOpenApp("certificates")} title="証明書"><FileKey2 size={14} /><span>証明書</span></button>
          <button className={app === "events" ? "quick-active" : ""} onClick={() => onOpenApp("events")} title="イベント ビューアー"><FileText size={14} /><span>イベント</span></button>
          {server.role === "dns" && <button className={app === "dns" ? "quick-active" : ""} onClick={() => onOpenApp("dns")} title="DNSマネージャー"><Network size={14} /><span>DNS</span></button>}
          {server.role === "database" && <button className={app === "database" ? "quick-active" : ""} onClick={() => onOpenApp("database")} title="SQL*Plus"><Database size={14} /><span>SQL*Plus</span></button>}
          {server.role === "application" && <button className={app === "resinConfig" ? "quick-active" : ""} onClick={() => onOpenApp("resinConfig")} title="Resin設定"><FileText size={14} /><span>Resin設定</span></button>}
          <button className={!app ? "quick-active terminal-return" : "terminal-return"} onClick={onCloseApp}><Terminal size={14} /><span>cmd</span></button>
        </div>

        {app ? (
          <ManagerWindow
            app={app}
            server={server}
            environment={environment}
            scenario={scenario}
            dns={dns}
            dnsDraft={dnsDraft}
            transfer={transfer}
            migrationStrategy={migrationStrategy}
            draft={draft}
            issues={issueEvents}
            taskRuns={taskRuns}
            sourceDatabaseRevision={sourceDatabaseRevision}
            onExport={onExport}
            onImport={onImport}
            onServiceToggle={onServiceToggle}
            onServiceStartupTypeChange={onServiceStartupTypeChange}
            onSoftwareInstall={onSoftwareInstall}
            onDatabaseWrite={onDatabaseWrite}
            onDnsDraftChange={onDnsDraftChange}
            onDnsApply={onDnsApply}
            onJdbcChange={onJdbcChange}
            onJdbcSave={onJdbcSave}
            onConfigSave={onConfigSave}
            onTaskRun={onTaskRun}
            onNotify={onNotify}
          />
        ) : (
          <div className="terminal">
            <div className="terminal-meta"><span><i />{shellMode === "powershell" ? "Windows PowerShell" : "C:\\Windows\\System32\\cmd.exe"}</span><span>Administrator</span></div>
            <div className="terminal-scroll" key={server.id}>
              <div className="terminal-welcome">{shellMode === "powershell" ? "Windows PowerShell\nCopyright (C) Microsoft Corporation. All rights reserved." : <>Microsoft Windows [Version {server.operatingSystem.includes("2019") ? "10.0.17763.0" : "10.0.14393.0"}]<br />(c) Microsoft Corporation. All rights reserved.</>}</div>
              {history.map((entry) => <div className="command-result" key={entry.id}><div className="command-echo"><span>{shellMode === "powershell" ? "PS C:\\Users\\Administrator>" : "C:\\Users\\Administrator>"}</span> {entry.command}</div><div className="command-output">{entry.output.map((line, index) => <div key={index} className={line.startsWith("***") || line.startsWith("'") ? "output-error" : ""}>{line || "\u00a0"}</div>)}</div></div>)}
              <form className="command-entry" onSubmit={handleSubmit}><label htmlFor={`cmd-${server.id}`}>{shellMode === "powershell" ? "PS C:\\Users\\Administrator>" : "C:\\Users\\Administrator>"}</label><input id={`cmd-${server.id}`} value={input} onChange={(event) => onInputChange(event.target.value)} autoComplete="off" spellCheck={false} aria-label={`${server.hostname} command`} placeholder="コマンドを入力..." /><button type="submit" aria-label="コマンド実行"><Play size={14} /></button></form>
            </div>
            <div className="terminal-status"><span><span className="status-green" />準備完了</span><span>80×24</span></div>
          </div>
        )}
        <div className="machine-taskbar"><button className="start-button" title="Start"><span>⊞</span></button><span className="taskbar-host">{server.hostname}</span><span className="taskbar-clock"><Clock3 size={12} /> SERVER SESSION</span></div>
      </div>
      <div className="session-footer"><span><span className="session-dot" /> TCP/IP 接続</span><span>Administrator</span><button onClick={() => onNotify(`${server.hostname}: ${server.ipAddress}`)} title="接続情報を確認"><HardDrive size={12} /> 接続情報</button></div>
    </section>
  );
}

function ManagerWindow({
  app,
  server,
  environment,
  scenario,
  dns,
  dnsDraft,
  transfer,
  migrationStrategy,
  draft,
  issues,
  taskRuns,
  sourceDatabaseRevision,
  onExport,
  onImport,
  onServiceToggle,
  onServiceStartupTypeChange,
  onSoftwareInstall,
  onDatabaseWrite,
  onDnsDraftChange,
  onDnsApply,
  onJdbcChange,
  onJdbcSave,
  onConfigSave,
  onTaskRun,
  onNotify,
}: {
  app: ManagerApp;
  server: Server;
  environment: RuntimeEnvironment;
  scenario: Scenario;
  dns: DnsRuntime;
  dnsDraft: DnsRuntime;
  transfer: TransferPackage | null;
  migrationStrategy: DatabaseMigrationStrategy;
  draft: string;
  issues: Array<{ source: string; type: "Error" | "Warning"; message: string }>;
  taskRuns: Record<string, string>;
  sourceDatabaseRevision: number;
  onExport: (serverId: string, kind: TransferPackage["kind"], content?: string, databaseStrategy?: DatabaseMigrationStrategy) => void;
  onImport: (serverId: string) => void;
  onServiceToggle: (serverId: string, serviceId: string) => void;
  onServiceStartupTypeChange: (serverId: string, serviceId: string, startupType: RuntimeService["startupType"]) => void;
  onSoftwareInstall: (serverId: string, softwareName: string) => void;
  onDatabaseWrite: (serverId: string) => void;
  onDnsDraftChange: (dns: DnsRuntime) => void;
  onDnsApply: () => void;
  onJdbcChange: (value: string) => void;
  onJdbcSave: (content: string) => void;
  onConfigSave: (content: string) => void;
  onTaskRun: (taskId: string) => void;
  onNotify: (message: string) => void;
}) {
  const canImport = transfer?.kind === appTransferKind(app)
    && transfer.sourceServerId !== server.id
    && (transfer.kind !== "database" || (
      Boolean(environment.databaseVersion)
      && environment.services.some((service) => service.name.toLowerCase().startsWith("oracleservice") && service.status === "running")
    ))
    && (transfer.kind !== "services" || server.stage !== "target"
      || environment.installedSoftware.some((software) =>
        software.toLowerCase().startsWith(server.role === "application" ? "resin " : "oracle "),
      ));
  const dbSchemas = environment.databaseSchemas;
  const targetDatabase = scenario.assets.servers.find((item) => item.role === "database" && item.stage === "target");
  const targetDatabaseInfo = scenario.assets.databases.find((item) => item.serverId === targetDatabase?.id);
  const dataBehind = server.stage === "target" && sourceDatabaseRevision > (environment.databaseRevision ?? 0);
  const jdbcPlaceholder = targetDatabase
    ? `jdbc.url=jdbc:oracle:thin:@${targetDatabase.hostname}:${targetDatabaseInfo?.listenerPort ?? 1521}:${targetDatabaseInfo?.serviceName ?? "SERVICE"}`
    : "jdbc.url=jdbc:oracle:thin:@<DB_HOST>:1521:<SERVICE>";

  return (
    <div className={`manager-window ${app === "events" ? "event-manager" : ""}`}>
      <div className="mmc-menubar"><span>ファイル</span><span>操作</span><span>表示</span><span>ヘルプ</span></div>
      {app === "services" && <ManagerFrame title="サービス (ローカル)" icon={<Settings size={15} />}>
        <div className="manager-toolbar service-columns"><span>名前</span><span>状態</span><span>起動種類</span><span>実行ユーザー</span><span>操作</span></div>
        {environment.services.length ? environment.services.map((service) => <div className="manager-row service-columns" key={service.id}><div className="manager-primary"><Settings size={14} /><span><strong>{service.displayName}</strong><small>{service.name}</small></span></div><span className={`service-state ${service.status}`}>{service.status === "running" ? "実行中" : "停止"}</span><select className="service-startup-select" aria-label={`${service.displayName}の起動種類`} value={service.startupType} onChange={(event) => onServiceStartupTypeChange(server.id, service.id, event.currentTarget.value === "automatic" ? "automatic" : "manual")}><option value="automatic">自動</option><option value="manual">手動</option></select><span className="table-muted">{service.runAs}</span><button className="row-action" onClick={() => onServiceToggle(server.id, service.id)}><Power size={12} />{service.status === "running" ? "停止" : "開始"}</button></div>) : <EmptyManager text="サービスは見つかりませんでした。" /> }
        <div className="manager-bottom-actions"><span>{environment.services.length} 個のサービス</span><ManagerTransfer kind="services" source={environment.services.length > 0} canImport={canImport} onExport={() => onExport(server.id, "services")} onImport={() => onImport(server.id)} /></div>
      </ManagerFrame>}

      {app === "setup" && <ManagerFrame title={`ソフトウェア構成 - ${server.hostname}`} icon={<HardDrive size={15} />}>
        <p className="migration-instruction">このサーバーに必要なミドルウェアを導入します。導入後、サービス管理でサービスを起動してください。</p>
        <div className="middleware-list">
          {server.software.map((software) => {
            const installed = environment.installedSoftware.includes(software);
            const requiresJava = software.toLowerCase().startsWith("resin ");
            const hasJava = environment.installedSoftware.some((item) => item.toLowerCase().startsWith("java "));
            return <div className="middleware-row" key={software}>
              <div><strong>{software}</strong><small>{installed ? "インストール済み" : requiresJava && !hasJava ? "前提条件: Java" : "未インストール"}</small></div>
              <button className={installed ? "installed" : "manager-primary-button"} disabled={installed || (requiresJava && !hasJava)} onClick={() => onSoftwareInstall(server.id, software)}>
                {installed ? <><Check size={13} />導入済み</> : "インストール"}
              </button>
            </div>;
          })}
          {!server.software.length && <EmptyManager text="このシナリオに導入対象のソフトウェアはありません。" />}
        </div>
        <div className="middleware-note">Java → Resinの順で導入し、Resin / Oracleはサービスを起動して待受状態を確認します。</div>
      </ManagerFrame>}

      {app === "explorer" && <ManagerFrame title={`エクスプローラー - ${server.hostname}`} icon={<FolderOpen size={15} />}>
        <div className="explorer-address">PC　›　ローカル ディスク (C:)　›　</div>
        <div className="explorer-file-list">
          <span><FolderOpen size={14} /> Program Files</span><span><FolderOpen size={14} /> Windows</span>
          {server.role === "application" && <><span><FolderOpen size={14} /> imart</span><span><FolderOpen size={14} /> resin</span></>}
          {environment.configurationFiles.map((file) => <span key={file.id}><FileText size={14} /> {file.name}</span>)}
          {environment.jdbcProperties && <span><FileText size={14} /> jdbc.properties</span>}
          {environment.tasks.map((task) => <span key={task.id}><FileText size={14} /> {task.executable.split("\\").at(-1)}</span>)}
        </div>
      </ManagerFrame>}

      {app === "tasks" && <ManagerFrame title="タスク スケジューラ ライブラリ" icon={<ListTodo size={15} />}>
        <div className="manager-toolbar task-columns"><span>タスク / 実行ファイル</span><span>実行時間</span><span>実行ユーザー</span><span>前回の結果</span><span>操作</span></div>
        {environment.tasks.length ? environment.tasks.map((task) => <div className="manager-row task-columns" key={task.id}><div className="manager-primary"><FolderClock size={14} /><span><strong>{task.name}</strong><small>{task.executable}</small></span></div><span className="table-muted">{task.schedule}</span><span className="table-muted">{task.runAs}</span><span className="service-state running">{taskRuns[task.id] ?? "未実行"}</span><button className="row-action" onClick={() => { onTaskRun(task.id); onNotify(`${task.name} を実行しました`); }}><Play size={12} />試運転</button></div>) : <EmptyManager text="このコンピューターにはタスクがありません。" />}
        <div className="manager-bottom-actions"><span>{environment.tasks.length} 個のタスク</span><ManagerTransfer kind="tasks" source={environment.tasks.length > 0} canImport={canImport} onExport={() => onExport(server.id, "tasks")} onImport={() => onImport(server.id)} /></div>
      </ManagerFrame>}

      {app === "certificates" && <ManagerFrame title="証明書 - ローカル コンピューター" icon={<FileKey2 size={15} />}>
        <div className="cert-store"><span>証明書 (ローカル コンピューター)</span><span className="tree-line">└ 個人</span><span className="tree-line">└ 中間証明機関</span><span className="tree-line">└ 信頼されたルート証明機関</span></div>
        <div className="manager-toolbar cert-columns"><span>発行先</span><span>発行者</span><span>有効期限</span><span>秘密キー</span></div>
        {environment.certificates.length ? environment.certificates.map((certificate) => <div className="manager-row cert-columns" key={certificate.id}><div className="manager-primary"><FileKey2 size={14} /><span><strong>{certificate.subject}</strong><small>{certificateStoreLabel(certificate.store)} · {certificate.id}</small></span></div><span className="table-muted">{certificate.issuer}</span><span className="table-muted">{certificate.expiresOn}</span><span className={certificate.hasPrivateKey ? "key-present" : "key-missing"}>{certificate.hasPrivateKey ? "あり" : "なし"}</span></div>) : <EmptyManager text="このストアに証明書はありません。" />}
        <div className="manager-bottom-actions"><span>{environment.certificates.length} 個の証明書</span><ManagerTransfer kind="certificates" source={environment.certificates.length > 0} canImport={canImport} onExport={() => onExport(server.id, "certificates")} onImport={() => onImport(server.id)} /></div>
      </ManagerFrame>}

      {app === "events" && <ManagerFrame title="イベント ビューアー (ローカル)" icon={<FileText size={15} />}>
        <div className="event-layout"><div className="event-tree"><span>カスタム ビュー</span><span className="tree-line">Windowsログ</span><b>├ アプリケーション</b><span>├ セキュリティ</span><span>└ システム</span><span className="event-filter">現在のログをフィルター...</span></div><div className="event-detail"><div className="event-toolbar"><span>レベル</span><span>ソース</span><span>イベント</span></div>{issues.length ? issues.map((item, index) => <div className="event-row" key={`${item.source}-${index}`}><span className={`event-level ${item.type.toLowerCase()}`}><AlertCircle size={13} />{item.type === "Error" ? "エラー" : "警告"}</span><span>{item.source}</span><span>イベント {index === 0 ? 1001 : 1002}</span><p>{item.message}</p></div>) : <EmptyManager text="表示するイベントはありません。切替後に再読み込みしてください。" />}</div></div>
      </ManagerFrame>}

      {app === "dns" && <ManagerFrame title={`DNS マネージャー - ${server.hostname}`} icon={<Network size={15} />}>
        <div className="dns-record-card"><div className="dns-card-icon"><Network size={17} /></div><div><small>前方参照ゾーン / A レコード</small><strong>{scenario.assets.dns[0].name}</strong></div><span className="dns-ttl">TTL {dns.ttlSeconds}s</span></div>
        <p className="migration-instruction">DNSの適用は名前解決先を変える「切替」です。先にAPSV02へ直接HTTP疎通を確認し、TTLだけを300秒以下に変更して適用してください。TTL短縮後の待機はシミュレーションでは完了扱いです。Aレコードを同時に変更すると旧キャッシュが残るため、切替後はnslookupとHTTP疎通で確認し、必要なら ipconfig /flushdns を実行してください。</p>
        <label className="dns-form-row"><span>接続先 IPv4 アドレス</span><select value={dnsDraft.address} onChange={(event) => onDnsDraftChange({ ...dnsDraft, address: event.target.value })}>{scenario.assets.servers.filter((item) => item.role === "application").map((item) => <option value={item.ipAddress} key={item.id}>{item.hostname} — {item.ipAddress}</option>)}</select></label>
        <label className="dns-form-row"><span>TTL</span><select value={dnsDraft.ttlSeconds} onChange={(event) => onDnsDraftChange({ ...dnsDraft, ttlSeconds: Number(event.target.value) })}><option value={86400}>24 時間 (86400 秒)</option><option value={3600}>1 時間 (3600 秒)</option><option value={300}>5 分 (300 秒)</option><option value={60}>1 分 (60 秒)</option></select></label>
        {dnsDraft.ttlSeconds > 300 && <div className="dns-warning"><AlertCircle size={14} />切替前にTTLを短縮して反映待ち時間を減らしてください。</div>}
        <div className="manager-bottom-actions"><span>適用前のレコード: {dns.address}</span><button className="manager-primary-button" onClick={onDnsApply}><Check size={13} />適用</button></div>
      </ManagerFrame>}

      {app === "notepad" && <ManagerFrame title="Notepad - jdbc.properties" icon={<FileText size={15} />}>
        <div className="notepad-info">{environment.jdbcProperties ? "C:\\imart\\config\\jdbc.properties" : "ファイルが見つかりません。移行元から設定ファイルをコピーしてください。"}</div>
        <p className="migration-instruction">{server.stage === "target"
          ? `旧APからコピーを受け取った後、jdbc.url を ${targetDatabase?.hostname ?? "新DB"}:${targetDatabaseInfo?.listenerPort ?? 1521}:${targetDatabaseInfo?.serviceName ?? "SERVICE"} に変更して「保存」してください。正しい接続先を保存するまで監査完了になりません。`
          : "APSV01で「コピーを準備」し、APSV02のjdbc.propertiesで「コピーを受け取る」操作をします。コピー後、新DBの接続先に修正してください。"}</p>
        <textarea className="notepad-editor" value={draft} onChange={(event) => onJdbcChange(event.target.value)} spellCheck={false} placeholder={jdbcPlaceholder} aria-label="JDBC設定ファイルの内容" />
        <div className="manager-bottom-actions"><span>Java Properties · UTF-8</span><div className="manager-action-group">{canImport && <button className="manager-secondary-button" onClick={() => onImport(server.id)}><ArrowDownToLine size={13} />コピーを受け取る</button>}{server.stage !== "target" && <button className="manager-secondary-button" onClick={() => onExport(server.id, "jdbc", draft)}><ArrowUpFromLine size={13} />コピーを準備</button>}<button className="manager-primary-button" onClick={() => onJdbcSave(draft)} disabled={!draft.trim()}><Check size={13} />保存</button></div></div>
      </ManagerFrame>}

      {app === "resinConfig" && <ManagerFrame title="Notepad - resin.conf" icon={<FileText size={15} />}>
        <div className="notepad-info">{environment.configurationFiles[0]?.path ?? "設定ファイルがありません。移行元からコピーしてください。"}</div>
        <textarea className="notepad-editor" value={draft} onChange={(event) => onJdbcChange(event.target.value)} spellCheck={false} placeholder="<server port='8080' address='10.10.2.21' />" aria-label="Resin設定ファイルの内容" />
        <div className="manager-bottom-actions"><span>Resin 4 · UTF-8</span><div className="manager-action-group">{canImport && <button className="manager-secondary-button" onClick={() => onImport(server.id)}><ArrowDownToLine size={13} />コピーを受け取る</button>}{server.stage !== "target" && <button className="manager-secondary-button" onClick={() => onExport(server.id, "configFile")}><ArrowUpFromLine size={13} />コピーを準備</button>}<button className="manager-primary-button" onClick={() => onConfigSave(draft)} disabled={!draft.trim()}><Check size={13} />保存</button></div></div>
      </ManagerFrame>}

      {app === "database" && <ManagerFrame title={`SQL*Plus — ${server.hostname}`} icon={<Database size={15} />}>
        <div className="database-console"><span>SQL*Plus: Release {environment.databaseVersion ?? "未インストール"} - Production</span><span>Connected to:</span><strong>Oracle Database {environment.databaseVersion ?? "未インストール"}</strong><span>接続先: {server.hostname}</span></div>
        {server.stage === "target" && (!environment.databaseVersion
          || !environment.services.some((service) => service.name.toLowerCase().startsWith("oracleservice") && service.status === "running"))
          && <p className="migration-instruction">{environment.databaseVersion ? "Oracleサービスが停止しています。移行操作の前にservices.mscで起動してください。" : "Oracle Databaseが未導入です。セットアップからインストールし、services.mscでOracleサービスを起動してください。"}</p>}
        <div className="database-schema-title"><strong>ユーザースキーマ</strong><span>{dbSchemas.length} 件</span></div>
        {dbSchemas.length ? <div className="schema-list">{dbSchemas.map((schemaName) => <span key={schemaName}><Database size={13} />{schemaName}<i>VALID</i></span>)}</div> : <EmptyManager text="ユーザースキーマがありません。" />}
        <div className={`database-revision ${dataBehind ? "behind" : ""}`}>
          <span>{environment.databaseRole === "unconfigured" ? "DBロール未構成" : `${environment.databaseRole === "primary" ? "Primary" : "Standby"} · データ世代 ${environment.databaseRevision ?? 0}`}</span>
          {server.stage === "target" && <span>現行DB: {sourceDatabaseRevision} · {dataBehind ? "未同期の更新あり" : "同期済み"}</span>}
        </div>
        {server.role === "database" && environment.databaseRole === "primary" && <button className="database-write-button" onClick={() => onDatabaseWrite(server.id)}>業務更新を1件発生させる</button>}
        <p className="migration-instruction">{migrationStrategy === "expdp"
          ? "Data Pump: 移行元でexpdp、移行先でimpdp。業務更新後は再実行して最終同期します。"
          : migrationStrategy === "rman"
            ? "RMAN: 移行元で rman backup、移行先で rman restore。バックアップ後の更新は再バックアップ・リストアが必要です。"
            : "Data Guard: 移行元で dgmgrl prepare、移行先で dgmgrl start standby。更新は自動同期され、同期後に移行先で dgmgrl switchover を実行します。"}</p>
        <div className="manager-bottom-actions"><span>{migrationStrategy === "expdp" ? "Data Pump" : migrationStrategy === "rman" ? "RMAN" : "Data Guard"} · 移行方式</span><ManagerTransfer
          kind="database"
          source={dbSchemas.length > 0}
          canImport={canImport}
          importLabel={server.stage === "target" && transfer?.kind === "database" && transfer.revision === sourceDatabaseRevision && sourceDatabaseRevision > 0 ? "同期済みデータを適用" : migrationStrategy === "dataguard" ? "Standby開始" : migrationStrategy === "rman" ? "リストア" : "インポート"}
          exportLabel={migrationStrategy === "expdp" ? "Data Pump準備" : migrationStrategy === "rman" ? "バックアップ" : "初期同期準備"}
          onExport={() => onExport(server.id, "database", undefined, migrationStrategy)}
          onImport={() => onImport(server.id)}
        /></div>
      </ManagerFrame>}
    </div>
  );
}

function ManagerFrame({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <div className="mmc-frame"><div className="mmc-frame-title">{icon}<strong>{title}</strong><span>▣</span></div><div className="mmc-content">{children}</div></div>;
}

function ManagerTransfer({ kind, source, canImport, exportLabel, importLabel, onExport, onImport }: { kind: TransferPackage["kind"]; source: boolean; canImport: boolean | undefined; exportLabel?: string; importLabel?: string; onExport: () => void; onImport: () => void }) {
  return <div className="manager-action-group">
    {source && <button className="manager-secondary-button" onClick={onExport}><ArrowUpFromLine size={13} />{exportLabel ?? "エクスポート"}</button>}
    {canImport && <button className="manager-primary-button" onClick={onImport}><ArrowDownToLine size={13} />{importLabel ?? "インポート"}</button>}
    {!source && !canImport && <span className="manager-hint">{kind === "database" ? "移行データなし" : "移行元でエクスポートしてください"}</span>}
  </div>;
}

function EmptyManager({ text }: { text: string }) {
  return <div className="manager-empty"><HardDrive size={20} /><span>{text}</span></div>;
}

function appTransferKind(app: ManagerApp): TransferPackage["kind"] | null {
  if (app === "services" || app === "tasks" || app === "certificates" || app === "database") return app;
  if (app === "notepad") return "jdbc";
  if (app === "resinConfig") return "configFile";
  return null;
}

function managerTitle(app: ManagerApp): string {
  const titles: Record<ManagerApp, string> = {
    setup: "ソフトウェア構成",
    services: "サービス",
    tasks: "タスク スケジューラ",
    certificates: "証明書",
    events: "イベント ビューアー",
    dns: "DNS マネージャー",
    notepad: "Notepad - jdbc.properties",
    resinConfig: "Notepad - resin.conf",
    explorer: "エクスプローラー",
    database: "SQL*Plus",
  };
  return titles[app];
}

function modeLabel(mode: DifficultyMode): string {
  const labels: Record<DifficultyMode, string> = {
    tutorial: "チュートリアル",
    beginner: "初級",
    intermediate: "中級",
    advanced: "上級",
    expert: "エキスパート",
  };
  return labels[mode];
}

function providerLabel(provider: DeploymentProvider): string {
  const labels: Record<DeploymentProvider, string> = {
    onprem: "オンプレミス",
    aws: "AWS / EC2",
    azure: "Azure",
  };
  return labels[provider];
}

function certificateStoreLabel(store: Certificate["store"]): string {
  const labels: Record<Certificate["store"], string> = {
    personal: "個人",
    intermediate: "中間CA",
    trustedRoot: "信頼されたルート",
  };
  return labels[store];
}

export default App;
