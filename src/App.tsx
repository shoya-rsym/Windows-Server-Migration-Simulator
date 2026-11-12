import { useMemo, useState } from "react";
import {
  Activity,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Bell,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Clock3,
  Command,
  Database,
  FileText,
  Gauge,
  HardDrive,
  Lightbulb,
  LockKeyhole,
  Network,
  Play,
  RefreshCw,
  Search,
  Server,
  Shield,
  Terminal,
  TriangleAlert,
  X,
} from "lucide-react";
import scenarioJson from "./data/scenarios/windows-server-2016-to-2019.json";
import { completeCurrentPhase, getPhaseStatus, getScore, initialGameState } from "./domain/game";
import type { GameState, PhaseId, Scenario } from "./domain/models";
import { loadScenario } from "./domain/scenario";

const scenario = loadScenario(scenarioJson);
const phaseIcons = [Search, Network, Server, Database, HardDrive, ArrowUpRight, TriangleAlert];
const migrationItems = [
  { id: "java", title: "Java 8 Runtime", detail: "互換性を優先し、現行の実行環境を維持" },
  { id: "resin", title: "Resin 4.0", detail: "ライセンスとサービス起動設定を確認" },
  { id: "jdbc", title: "JDBC接続設定", detail: "接続先を新DBサーバーへ変更" },
  { id: "certificate", title: "SSL証明書 + 秘密鍵", detail: "PFXを安全にエクスポート・インポート" },
  { id: "task", title: "タスクスケジューラ", detail: "DailyExcelExport の実行条件を移行" },
  { id: "war", title: "intra-mart WAR", detail: "アプリ資材と環境固有設定を分離して配備" },
];

const methodOptions = [
  { id: "expdp", name: "EXPDP / IMPDP", tag: "おすすめ", downtime: "中", effort: "低", risk: "低", detail: "論理移行。スキーマ単位で移行でき、異なるDBバージョン間に適しています。", points: 0 },
  { id: "rman", name: "RMAN", tag: "高速", downtime: "短", effort: "中", risk: "中", detail: "物理バックアップを使った移行。停止時間を短縮しやすい一方、互換性確認が必要です。", points: 5 },
  { id: "dataguard", name: "Data Guard", tag: "低停止", downtime: "最短", effort: "高", risk: "高", detail: "同期後にスイッチオーバー。ライセンス・構成・事前検証の負荷が高くなります。", points: 10 },
];

const repairOptions = [
  { id: "certificate", label: "秘密鍵を含む証明書をインポートする" },
  { id: "jdbc", label: "JDBC接続先を新DBに変更する" },
  { id: "task", label: "タスクスケジューラ設定を移行する" },
  { id: "service", label: "Resinサービスを自動起動に設定する" },
];

function App() {
  const [state, setState] = useState<GameState>(initialGameState);
  const [selectedCommand, setSelectedCommand] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const score = useMemo(() => getScore(state), [state]);
  const currentPhaseIndex = scenario.phases.findIndex((phase) => phase.id === state.currentPhase);
  const currentPhase = scenario.phases[currentPhaseIndex];
  const completedCount = state.completedPhases.length;
  const progress = Math.round((completedCount / scenario.phases.length) * 100);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  };

  const goToPhase = (phaseId: PhaseId, index: number) => {
    if (getPhaseStatus(phaseId, index, state.completedPhases) === "locked") return;
    setState((previous) => ({ ...previous, currentPhase: phaseId }));
  };

  const runCommand = (command: string) => {
    if (!state.commandOutputs.includes(command)) {
      const definition = scenario.commands.find((item) => item.command === command);
      setState((previous) => ({
        ...previous,
        commandOutputs: [...previous.commandOutputs, command],
        eventLog: [...previous.eventLog, `09:${String(10 + previous.commandOutputs.length).padStart(2, "0")}  ${command} を実行しました。`],
      }));
      setSelectedCommand(command);
      if (definition) notify(`${definition.title}の調査結果を記録しました`);
    } else {
      setSelectedCommand(command);
    }
  };

  const completePhase = () => {
    if (!currentPhase) return;
    if (state.currentPhase === "application-migration" && state.migratedAssets.length < 6) {
      const omitted = 6 - state.migratedAssets.length;
      setState((previous) => {
        const next = completeCurrentPhase(previous, scenario);
        return {
          ...next,
          migrationSuccess: Math.max(50, previous.migrationSuccess - omitted * 8),
          riskPoints: previous.riskPoints + omitted * 8,
          eventLog: [...next.eventLog, `移行漏れ ${omitted} 件を記録。成功率が低下しました。`],
        };
      });
    } else {
      setState((previous) => completeCurrentPhase(previous, scenario));
    }
  };

  const changeBuildOption = (key: keyof GameState["buildOptions"], value: string) => {
    setState((previous) => ({
      ...previous,
      buildOptions: { ...previous.buildOptions, [key]: value },
    migrationSuccess: key === "javaVersion"
      ? Math.max(
          50,
          Math.min(
            100,
            previous.migrationSuccess +
              (value === "Java 17"
                ? previous.buildOptions.javaVersion === "Java 17" ? 0 : -15
                : previous.buildOptions.javaVersion === "Java 17" ? 15 : 0),
          ),
        )
      : previous.migrationSuccess,
    eventLog:
      key === "javaVersion" && value === "Java 17" && previous.buildOptions.javaVersion !== "Java 17"
        ? [...previous.eventLog, "Java 17を選択。intra-mart / Resinの互換性検証が必要です。"]
        : previous.eventLog,
    }));
  };

  const selectDatabaseMethod = (methodId: string) => {
    const method = methodOptions.find((item) => item.id === methodId);
    if (!method) return;
    setState((previous) => ({
      ...previous,
      databaseMethod: methodId,
      migrationSuccess: Math.max(
        50,
        Math.min(
          100,
          previous.migrationSuccess +
            (methodOptions.find((item) => item.id === previous.databaseMethod)?.points ?? 0) -
            method.points,
        ),
      ),
      downtimeMinutes: methodId === "dataguard" ? 10 : methodId === "rman" ? 35 : 60,
      eventLog: [...previous.eventLog, `DB移行方式に${method.name}を選択しました。`],
    }));
  };

  const toggleMigrationAsset = (assetId: string) => {
    setState((previous) => ({
      ...previous,
      migratedAssets: previous.migratedAssets.includes(assetId)
        ? previous.migratedAssets.filter((item) => item !== assetId)
        : [...previous.migratedAssets, assetId],
    }));
  };

  const switchDns = () => {
    setState((previous) => ({
      ...previous,
      cutover: { ...previous.cutover, dnsSwitched: true },
      downtimeMinutes: previous.downtimeMinutes + (previous.cutover.ttlMinutes >= 1440 ? 20 : 5),
      eventLog: [...previous.eventLog, `DNS AレコードをAPSV02 (10.10.2.21)へ切り替えました。TTL ${previous.cutover.ttlMinutes}分。`],
    }));
  };

  const attemptRepair = (repairId: string) => {
    const incident = state.activeIncident;
    if (!incident) return;
    if (repairId === incident.repairAction) {
      setState((previous) => ({
        ...previous,
        incidentSolved: true,
        incidentAttempted: true,
        downtimeMinutes: previous.downtimeMinutes + 2,
        eventLog: [...previous.eventLog, `障害「${incident.title}」を復旧しました。`],
      }));
      notify("原因を特定し、システムを復旧しました");
    } else {
      setState((previous) => ({
        ...previous,
        incidentAttempted: true,
        downtimeMinutes: previous.downtimeMinutes + 15,
        migrationSuccess: Math.max(50, previous.migrationSuccess - 5),
        eventLog: [...previous.eventLog, `誤った対応により停止時間が15分増加しました。`],
      }));
      notify("症状が解消しません。ログと原因を再確認してください");
    }
  };

  const isComplete = state.completedPhases.length === scenario.phases.length;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><RefreshCw size={19} strokeWidth={2.4} /></div>
          <div><div className="brand-name">MIGRATION<span>LAB</span></div><div className="brand-caption">LEARNING SIMULATOR</div></div>
        </div>
        <div className="workspace-label">WORKSPACE</div>
        <div className="workspace-card">
          <div className="workspace-icon"><Server size={17} /></div>
          <div className="workspace-copy"><strong>更改プロジェクト</strong><span>本番環境 · 初級</span></div>
          <ChevronDown size={15} className="muted" />
        </div>
        <div className="sidebar-section-label">PROJECT FLOW <span>7 PHASES</span></div>
        <nav className="phase-nav" aria-label="プロジェクトフェーズ">
          {scenario.phases.map((phase, index) => {
            const Icon = phaseIcons[index];
            const status = getPhaseStatus(phase.id, index, state.completedPhases);
            return (
              <button
                className={`phase-link ${status} ${state.currentPhase === phase.id ? "selected" : ""}`}
                key={phase.id}
                onClick={() => goToPhase(phase.id, index)}
                disabled={status === "locked"}
              >
                <span className="phase-link-icon">{status === "completed" ? <Check size={15} /> : <Icon size={16} />}</span>
                <span className="phase-link-title"><small>PHASE 0{index + 1}</small>{phase.shortTitle}</span>
                {status === "locked" && <LockKeyhole size={13} className="lock-icon" />}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="tip-card"><div className="tip-icon"><Lightbulb size={16} /></div><div><strong>学習のヒント</strong><p>調査結果はあとで見返せます。まずは現行環境の全体像をつかみましょう。</p></div></div>
          <button className="help-button"><CircleHelp size={16} /> ヘルプとガイド <ArrowUpRight size={14} /></button>
          <div className="profile"><div className="avatar">YS</div><div><strong>山田 翔太</strong><span>移行プロジェクト担当</span></div><MoreDots /></div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumbs"><span>プロジェクト</span><span className="crumb-slash">/</span><strong>{scenario.title}</strong><span className="status-pill"><i />進行中</span></div>
          <div className="topbar-actions"><div className="save-status"><span className="save-dot" /> セッション内で記録中</div><button className="icon-button" aria-label="通知"><Bell size={17} /><i /></button><div className="topbar-divider" /><span className="topbar-date">2024年 3月 14日</span></div>
        </header>

        <div className="page-content">
          <section className="project-heading">
            <div className="heading-main">
              <div className="eyebrow"><span>PROJECT SIMULATION</span><span className="eyebrow-line" /></div>
              <h1>{scenario.title}</h1>
              <p>{scenario.description}</p>
            </div>
            <button className="guide-button" onClick={() => notify("シナリオガイドを準備しています")}><BookOpen size={16} /> シナリオガイド <ArrowUpRight size={14} /></button>
          </section>

          <section className="overview-grid" aria-label="プロジェクト概要">
            <MetricCard icon={<Activity size={17} />} label="プロジェクト進捗" value={`${progress}%`} sub={`${completedCount} / 7 フェーズ完了`} accent="blue" progress={progress} />
            <MetricCard icon={<Clock3 size={17} />} label="サービス停止時間" value={`${state.downtimeMinutes}`} unit="分" sub={state.downtimeMinutes > 30 ? "目標を超過しています" : "目標: 30分以内"} accent={state.downtimeMinutes > 30 ? "orange" : "green"} />
            <MetricCard icon={<Gauge size={17} />} label="移行成功率" value={`${state.migrationSuccess}`} unit="%" sub={state.migrationSuccess >= 90 ? "計画どおり進行中" : "移行リスクに注意"} accent={state.migrationSuccess >= 90 ? "green" : "orange"} />
            <MetricCard icon={<BadgeCheck size={17} />} label="現在のスコア" value={`${score.total}`} unit="/ 100" sub={isComplete ? "シミュレーション完了" : "最終評価"} accent="purple" />
          </section>

          <div className="work-layout">
            <section className="work-card">
              <div className="work-card-heading">
                <div className="phase-heading-icon">{(() => { const Icon = phaseIcons[currentPhaseIndex]; return <Icon size={18} />; })()}</div>
                <div className="phase-heading-copy"><div className="phase-kicker">PHASE 0{currentPhaseIndex + 1} <span>·</span> {currentPhase?.shortTitle}</div><h2>{currentPhase?.title}</h2></div>
                <div className="task-count">{getTaskCount(state, currentPhase.id)}<span>タスク</span></div>
              </div>
              <p className="phase-objective">{currentPhase?.objective}</p>
              <PhaseContent
                phase={state.currentPhase}
                state={state}
                selectedCommand={selectedCommand}
                onCommand={runCommand}
                onArchitecture={(answer) => setState((previous) => ({
                  ...previous,
                  architectureAnswer: answer,
                  migrationSuccess: answer === "correct" ? previous.migrationSuccess : Math.max(50, previous.migrationSuccess - 5),
                }))}
                onBuildOption={changeBuildOption}
                onDatabaseMethod={selectDatabaseMethod}
                onToggleAsset={toggleMigrationAsset}
                onCutover={(patch) => setState((previous) => ({ ...previous, cutover: { ...previous.cutover, ...patch } }))}
                onSwitchDns={switchDns}
                onRepair={attemptRepair}
                notify={notify}
              />
              <div className="work-card-footer">
                <div className="footer-note"><Shield size={14} /> 操作内容はシミュレーション環境にのみ反映されます</div>
                <div className="footer-actions">
                  {currentPhaseIndex > 0 && <button className="button-secondary" onClick={() => goToPhase(scenario.phases[currentPhaseIndex - 1].id, currentPhaseIndex - 1)}><ArrowLeft size={15} /> 前のフェーズ</button>}
                  {!isComplete && <button className="button-primary" disabled={!canAdvance(state, scenario)} onClick={completePhase}>{state.currentPhase === "incident-response" ? "プロジェクトを完了" : "フェーズを完了"} <ArrowRight size={15} /></button>}
                  {isComplete && <span className="completion-label"><CheckCircle2 size={17} /> 移行プロジェクト完了</span>}
                </div>
              </div>
            </section>

            <aside className="insights-column">
              <section className="side-card score-card">
                <div className="side-card-heading"><div><span className="side-card-kicker">PERFORMANCE</span><h3>評価スコア</h3></div><button className="more-button" aria-label="スコアの詳細"><MoreDots /></button></div>
                <div className="score-summary"><div className="score-ring" style={{ "--score": `${score.total}%` } as React.CSSProperties}><div><strong>{score.total}</strong><span>POINTS</span></div></div><div className="score-summary-copy"><strong>{getScoreLabel(score.total)}</strong><span>最終スコア予測</span><small>各フェーズの判断で変動します</small></div></div>
                <ScoreRow label="構成理解" value={score.architecture} max={20} color="blue" />
                <ScoreRow label="移行成功率" value={score.migration} max={40} color="green" />
                <ScoreRow label="停止時間" value={score.downtime} max={20} color="orange" />
                <ScoreRow label="障害対応" value={score.incidentResponse} max={20} color="purple" />
                <div className="score-total"><span>合計スコア</span><strong>{score.total}<small> / 100</small></strong></div>
              </section>
              <section className="side-card environment-card">
                <div className="side-card-heading"><div><span className="side-card-kicker">ENVIRONMENT</span><h3>システム構成</h3></div><button className="text-button" onClick={() => notify("構成一覧を表示しています")}>詳細 <ArrowUpRight size={13} /></button></div>
                <div className="environment-flow">
                  <EnvNode icon={<Server size={16} />} name="APサーバー" version="Windows Server 2016" status="稼働中" />
                  <div className="flow-connector"><span /><span /><span /></div>
                  <EnvNode icon={<Database size={16} />} name="DBサーバー" version="Oracle 11g" status="稼働中" />
                  <div className="flow-connector"><span /><span /><span /></div>
                  <EnvNode icon={<Network size={16} />} name="DNSサーバー" version="TTL 24時間" status="稼働中" />
                </div>
                <div className="environment-footer"><span><i className="legend-dot running" />稼働中</span><span><i className="legend-dot planned" />移行先環境</span></div>
              </section>
            </aside>
          </div>

          <section className="activity-card">
            <div className="activity-heading"><div><span className="side-card-kicker">ACTIVITY</span><h3>プロジェクトログ</h3></div><span className="live-indicator"><i /> LIVE</span><button className="text-button" onClick={() => notify("最新のログを表示しています")}>すべて表示 <ArrowUpRight size={13} /></button></div>
            <div className="activity-list">
              {[...state.eventLog].reverse().slice(0, 3).map((entry, index) => {
                const timestamp = entry.match(/^(\d{2}:\d{2})\s{2}(.*)$/);
                return <div className="activity-row" key={`${entry}-${index}`}><div className={`activity-icon ${index === 0 ? "latest" : ""}`}><FileText size={14} /></div><span className="activity-time">{timestamp?.[1] ?? "—"}</span><span className="activity-text">{timestamp?.[2] ?? entry}</span><span className="activity-actor">山田 翔太</span></div>;
              })}
            </div>
          </section>
          <footer className="page-footer"><span>© 2024 Migration Lab</span><span>学習用シミュレーション環境 <span className="footer-separator">·</span> v1.0.0</span></footer>
        </div>
      </main>
      {toast && <div className="toast"><CheckCircle2 size={16} />{toast}<button aria-label="閉じる" onClick={() => setToast("")}><X size={14} /></button></div>}
    </div>
  );
}

function MoreDots() {
  return <span className="more-dots"><i /><i /><i /></span>;
}

function MetricCard({ icon, label, value, unit, sub, accent, progress }: { icon: React.ReactNode; label: string; value: string; unit?: string; sub: string; accent: string; progress?: number }) {
  return <div className="metric-card"><div className="metric-top"><span className={`metric-icon ${accent}`}>{icon}</span><span className="metric-label">{label}</span><button className="metric-more" aria-label={`${label}の詳細`}><MoreDots /></button></div><div className="metric-value">{value}<small>{unit}</small></div>{progress !== undefined ? <div className="progress-track"><span style={{ width: `${progress}%` }} /></div> : null}<div className={`metric-sub ${accent === "orange" ? "warning" : ""}`}><i />{sub}</div></div>;
}

function ScoreRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return <div className="score-row"><div><span>{label}</span><strong>{value}<small>/{max}</small></strong></div><div className="score-track"><span className={color} style={{ width: `${max ? (value / max) * 100 : 0}%` }} /></div></div>;
}

function EnvNode({ icon, name, version, status }: { icon: React.ReactNode; name: string; version: string; status: string }) {
  return <div className="env-node"><span className="env-icon">{icon}</span><span className="env-copy"><strong>{name}</strong><small>{version}</small></span><span className="env-status"><i />{status}</span></div>;
}

function PhaseContent({ phase, state, selectedCommand, onCommand, onArchitecture, onBuildOption, onDatabaseMethod, onToggleAsset, onCutover, onSwitchDns, onRepair, notify }: {
  phase: PhaseId;
  state: GameState;
  selectedCommand: string | null;
  onCommand: (command: string) => void;
  onArchitecture: (answer: string) => void;
  onBuildOption: (key: keyof GameState["buildOptions"], value: string) => void;
  onDatabaseMethod: (method: string) => void;
  onToggleAsset: (assetId: string) => void;
  onCutover: (patch: Partial<GameState["cutover"]>) => void;
  onSwitchDns: () => void;
  onRepair: (repairId: string) => void;
  notify: (message: string) => void;
}) {
  if (phase === "investigation") {
    const output = scenario.commands.find((item) => item.command === selectedCommand);
    return <div className="phase-body">
      <div className="section-title-row"><div><h3>調査コマンド</h3><p>対象サーバー: <strong>APSV01</strong> <span className="terminal-prompt">C:\&gt;</span></p></div><span className="task-progress">{state.commandOutputs.length} / {scenario.commands.length} 完了</span></div>
      <div className="command-list">{scenario.commands.map((item) => <button key={item.command} className={`command-chip ${state.commandOutputs.includes(item.command) ? "done" : ""} ${selectedCommand === item.command ? "active" : ""}`} onClick={() => onCommand(item.command)}><span className="command-chip-icon">{state.commandOutputs.includes(item.command) ? <Check size={13} /> : <Terminal size={13} />}</span><code>{item.command}</code><span className="command-chip-label">{item.title}</span></button>)}</div>
      <div className="terminal-window"><div className="terminal-head"><div className="terminal-dots"><i /><i /><i /></div><span><Terminal size={12} /> Windows PowerShell</span><button onClick={() => notify("コマンド履歴をクリアしました")} aria-label="コマンド履歴をクリア"><X size={13} /></button></div><div className="terminal-output">{output ? <><div className="terminal-command"><b>PS C:\Users\Administrator&gt;</b> {output.command}</div>{output.output.map((line, index) => <div className="terminal-line" key={index}>{line || "\u00a0"}</div>)}<div className="terminal-insight"><Lightbulb size={13} /><span>{output.insight}</span></div></> : <div className="terminal-empty"><Command size={17} /><span>上のコマンドを選択して現行環境を調査しましょう。</span></div>}</div><div className="terminal-bottom"><span><i /> 接続中: APSV01</span><span>PowerShell 5.1</span></div></div>
    </div>;
  }
  if (phase === "architecture") {
    const choices = [
      { id: "correct", title: "AP → DB、利用者はDNS経由でAPへ接続", desc: "APサーバーがJDBCでOracleへ接続。DNS AレコードはAPのIPを指す。", icon: <Network size={18} /> },
      { id: "wrong-db", title: "利用者 → DBへ直接接続", desc: "利用者端末がOracleデータベースへ直接アクセスする。", icon: <Database size={18} /> },
      { id: "wrong-dns", title: "DNSはDBサーバーのIPを指す", desc: "本番FQDNをDBサーバーへ向けてアプリに接続する。", icon: <ArrowDown size={18} /> },
    ];
    return <div className="phase-body"><div className="section-title-row"><div><h3>正しい接続経路を選択</h3><p>調査したIPアドレスとポート情報をもとに判断してください。</p></div></div><div className="architecture-diagram"><div className="arch-node"><span><Network size={17} /></span><strong>利用者</strong><small>Webブラウザー</small></div><div className="arch-line"><i /><ArrowRight size={13} /></div><div className="arch-node"><span><Server size={17} /></span><strong>APサーバー</strong><small>10.10.1.21 · Resin</small></div><div className="arch-line"><i /><ArrowRight size={13} /></div><div className="arch-node"><span><Database size={17} /></span><strong>DBサーバー</strong><small>10.10.1.31 · Oracle</small></div></div><div className="choice-list">{choices.map((choice) => <button key={choice.id} className={`choice-card ${state.architectureAnswer === choice.id ? "selected" : ""}`} onClick={() => onArchitecture(choice.id)}><span className="choice-icon">{choice.icon}</span><span className="choice-copy"><strong>{choice.title}</strong><small>{choice.desc}</small></span><span className="choice-radio">{state.architectureAnswer === choice.id && <i />}</span></button>)}</div>{state.architectureAnswer && <div className={`inline-feedback ${state.architectureAnswer === "correct" ? "success" : "error"}`}>{state.architectureAnswer === "correct" ? <><CheckCircle2 size={15} /> 正解です。DNSは利用者をAPへ誘導し、APがJDBCでDBに接続します。</> : <><TriangleAlert size={15} /> 接続経路を再確認しましょう。WebアプリはAPサーバー上で稼働します。</>}</div>}</div>;
  }
  if (phase === "build") {
    return <div className="phase-body"><div className="section-title-row"><div><h3>移行先AP環境</h3><p>バージョン変更にはアプリケーション互換性の検証が必要です。</p></div><span className="recommended-pill"><Check size={12} />推奨構成</span></div><div className="build-summary"><div className="build-summary-icon"><Server size={22} /></div><div><strong>新APサーバー <span>APSV02</span></strong><small>移行先IP: 10.10.2.21 <span>·</span> 4 vCPU / 16 GB</small></div><span className="build-ready"><i />構築予定</span></div><div className="form-grid"><SelectField label="OS" value={state.buildOptions.operatingSystem} options={["Windows Server 2019", "Windows Server 2022"]} onChange={(v) => onBuildOption("operatingSystem", v)} /><SelectField label="Java Runtime" value={state.buildOptions.javaVersion} options={["Java 8", "Java 17"]} onChange={(v) => onBuildOption("javaVersion", v)} /><SelectField label="APサーバー" value={state.buildOptions.resinVersion} options={["Resin 4.0", "Resin 4.0 (最新パッチ)"]} onChange={(v) => onBuildOption("resinVersion", v)} /></div><div className={`compatibility-note ${state.buildOptions.javaVersion === "Java 17" ? "caution" : ""}`}><span>{state.buildOptions.javaVersion === "Java 8" ? <Shield size={16} /> : <TriangleAlert size={16} />}</span><div><strong>{state.buildOptions.javaVersion === "Java 8" ? "互換性を優先した構成" : "互換性検証が必要です"}</strong><p>{state.buildOptions.javaVersion === "Java 8" ? "Java 8を維持することで、既存intra-mart資産との互換性リスクを抑えられます。" : "Java 17は現行のResin / intra-martで動作するか、事前検証が必要です。成功率に影響します。"}</p></div></div></div>;
  }
  if (phase === "database-migration") {
    return <div className="phase-body"><div className="section-title-row"><div><h3>Oracle 11g → Oracle 19c</h3><p>停止時間、作業工数、移行リスクのバランスで方式を選びます。</p></div></div><div className="db-target"><div className="db-version"><span>現行</span><Database size={16} /><strong>Oracle 11g</strong><small>DBSV01 · 10.10.1.31</small></div><div className="db-migration-arrow"><ArrowRight size={18} /><small>移行</small></div><div className="db-version target"><span>移行先</span><Database size={16} /><strong>Oracle 19c</strong><small>DBSV02 · 10.10.2.31</small></div></div><div className="method-grid">{methodOptions.map((option) => <button key={option.id} className={`method-card ${state.databaseMethod === option.id ? "selected" : ""}`} onClick={() => onDatabaseMethod(option.id)}><div className="method-header"><strong>{option.name}</strong>{option.tag && <span>{option.tag}</span>}</div><p>{option.detail}</p><div className="method-stats"><span>停止時間 <b>{option.downtime}</b></span><span>工数 <b>{option.effort}</b></span><span>リスク <b className={option.risk === "高" ? "high-risk" : ""}>{option.risk}</b></span></div><i className="method-radio">{state.databaseMethod === option.id && <b />}</i></button>)}</div><div className="database-note"><Lightbulb size={15} /><span>初めての異なるバージョン間移行では、スキーマ単位で移行できるEXPDP/IMPDPが扱いやすい選択肢です。</span></div></div>;
  }
  if (phase === "application-migration") {
    return <div className="phase-body"><div className="section-title-row"><div><h3>移行対象資産チェックリスト</h3><p>チェックした資産のみ新環境に移行されます。漏れは切替後の障害原因になります。</p></div><span className={`task-progress ${state.migratedAssets.length < 5 ? "warning" : ""}`}>{state.migratedAssets.length} / 6 選択</span></div><div className="asset-list">{migrationItems.map((item) => <button key={item.id} className={`asset-item ${state.migratedAssets.includes(item.id) ? "checked" : ""}`} onClick={() => onToggleAsset(item.id)}><span className="asset-checkbox">{state.migratedAssets.includes(item.id) && <Check size={13} />}</span><span className="asset-copy"><strong>{item.title}</strong><small>{item.detail}</small></span><span className={`asset-tag ${["jdbc", "certificate", "task"].includes(item.id) ? "important" : ""}`}>{["jdbc", "certificate", "task"].includes(item.id) ? "重要" : "必須"}</span></button>)}</div><div className="migration-warning"><TriangleAlert size={15} /><span>5項目以上でフェーズを完了できますが、未移行資産は成功率を下げ、障害イベントの原因になります。</span></div></div>;
  }
  if (phase === "cutover") {
    const dnsOutput = state.cutover.dnsSwitched ? "10.10.2.21 (APSV02)" : "10.10.1.21 (APSV01)";
    return <div className="phase-body"><div className="section-title-row"><div><h3>本番切替チェックリスト</h3><p>順序を守り、利用者への影響を最小限に抑えて切り替えます。</p></div><span className="cutover-status"><i />{state.cutover.dnsSwitched ? "切替済み" : "切替前"}</span></div><div className="cutover-step"><div className={`step-check ${state.cutover.finalSync ? "done" : ""}`}>{state.cutover.finalSync ? <Check size={14} /> : "1"}</div><div className="cutover-step-copy"><strong>DB最終同期</strong><small>更新差分を移行先Oracle 19cに反映</small></div><button className={state.cutover.finalSync ? "step-done-button" : "step-button"} disabled={state.cutover.finalSync} onClick={() => onCutover({ finalSync: true })}>{state.cutover.finalSync ? "完了" : "同期を実行"}</button></div><div className="cutover-step"><div className={`step-check ${state.cutover.dnsSwitched ? "done" : ""}`}>{state.cutover.dnsSwitched ? <Check size={14} /> : "2"}</div><div className="cutover-step-copy"><strong>DNS TTL設定とAレコード切替</strong><small>現在: <b>{dnsOutput}</b></small></div><button className={state.cutover.dnsSwitched ? "step-done-button" : "step-button"} disabled={state.cutover.dnsSwitched || !state.cutover.finalSync} onClick={onSwitchDns}>{state.cutover.dnsSwitched ? "切替済み" : "DNS切替"}</button></div><div className="ttl-control"><label htmlFor="ttl">切替前TTL</label><select id="ttl" value={state.cutover.ttlMinutes} disabled={state.cutover.dnsSwitched} onChange={(event) => onCutover({ ttlMinutes: Number(event.target.value) })}><option value={1440}>24時間 (1440分)</option><option value={60}>1時間 (60分)</option><option value={5}>5分</option></select><span className={state.cutover.ttlMinutes > 60 ? "ttl-warning" : ""}>{state.cutover.ttlMinutes <= 5 ? "短いTTLで切替後の反映を早めます" : "切替前にTTLを短縮し、十分な時間をおいてください"}</span></div><div className="cutover-step last"><div className={`step-check ${state.cutover.servicesSwitched ? "done" : ""}`}>{state.cutover.servicesSwitched ? <Check size={14} /> : "3"}</div><div className="cutover-step-copy"><strong>新環境サービス起動・疎通確認</strong><small>Resin、JDBC接続、HTTPSを確認</small></div><button className={state.cutover.servicesSwitched ? "step-done-button" : "step-button"} disabled={state.cutover.servicesSwitched || !state.cutover.dnsSwitched} onClick={() => { onCutover({ servicesSwitched: true }); notify("新環境サービスを起動しました"); }}>{state.cutover.servicesSwitched ? "完了" : "サービス起動"}</button></div><div className="cutover-tip"><Lightbulb size={15} /><span>計画的な切替では、事前にTTLを短縮してDNSキャッシュの残存時間を減らします。</span></div></div>;
  }
  const incident = state.activeIncident;
  return <div className="phase-body">{incident ? <><div className="incident-banner"><span><TriangleAlert size={18} /></span><div><small>POST-CUTOVER INCIDENT</small><strong>{incident.title}</strong><p>{incident.description}</p></div><span className={`incident-state ${state.incidentSolved ? "resolved" : ""}`}>{state.incidentSolved ? "復旧済み" : "対応中"}</span></div><div className="section-title-row logs-title"><div><h3><FileText size={15} /> システムログ</h3><p>エラーメッセージから障害原因を特定してください。</p></div><button className="text-button" onClick={() => notify("最新ログを取得しました")}><RefreshCw size={13} /> 更新</button></div><div className="incident-logs">{incident.logs.map((line) => <code key={line}>{line}</code>)}</div>{!state.incidentSolved ? <><div className="section-title-row repair-title"><div><h3>対応アクションを選択</h3><p>ログの原因に合った復旧手順を選んでください。</p></div></div><div className="repair-grid">{repairOptions.map((option) => <button className="repair-option" key={option.id} onClick={() => onRepair(option.id)}><span><Play size={12} /></span>{option.label}<ArrowRight size={14} /></button>)}</div>{state.incidentAttempted && <div className="inline-feedback error"><TriangleAlert size={15} /> 対応後も障害が継続しています。ログの接続先や対象資産を再確認してください。</div>}</> : <div className="resolved-panel"><CheckCircle2 size={18} /><div><strong>サービスが復旧しました</strong><span>{incident.cause}</span></div></div>}</> : <div className="terminal-empty"><Activity size={18} />切替後の障害を準備しています。</div>}</div>;
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label className="select-field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select><ChevronDown size={14} /></label>;
}

function getTaskCount(state: GameState, phase: PhaseId): string {
  const counts: Record<PhaseId, string> = {
    investigation: `${state.commandOutputs.length}/${scenario.commands.length}`,
    architecture: state.architectureAnswer === "correct" ? "1/1" : "0/1",
    build: state.buildOptions.operatingSystem === "Windows Server 2019" ? "1/1" : "0/1",
    "database-migration": state.databaseMethod ? "1/1" : "0/1",
    "application-migration": `${state.migratedAssets.length}/6`,
    cutover: `${[state.cutover.finalSync, state.cutover.dnsSwitched, state.cutover.servicesSwitched].filter(Boolean).length}/3`,
    "incident-response": state.incidentSolved ? "1/1" : "0/1",
  };
  return counts[phase];
}

function canAdvance(state: GameState, data: Scenario): boolean {
  switch (state.currentPhase) {
    case "investigation": return state.commandOutputs.length >= data.commands.length;
    case "architecture": return state.architectureAnswer === "correct";
    case "build": return state.buildOptions.operatingSystem === "Windows Server 2019";
    case "database-migration": return state.databaseMethod !== null;
    case "application-migration": return state.migratedAssets.length >= 5;
    case "cutover": return state.cutover.finalSync && state.cutover.dnsSwitched && state.cutover.servicesSwitched;
    case "incident-response": return state.incidentSolved;
  }
}

function getScoreLabel(score: number): string {
  if (score >= 90) return "優秀な移行計画";
  if (score >= 70) return "安定したプロジェクト";
  if (score >= 50) return "改善の余地あり";
  return "慎重に進めましょう";
}

export default App;
