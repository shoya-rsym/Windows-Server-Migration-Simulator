import { useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, BookOpen, CheckCircle2, ClipboardCheck, RotateCcw, ShieldCheck } from "lucide-react";
import { createRuleBasedAdvisor } from "@se-simulator/advisor-engine";
import { calculateAssessment } from "@se-simulator/scoring-engine";
import { completeLearningObjective, createSimulationState, recordSimulationEvent, type SimulationState } from "@se-simulator/shared-engine";
import { decisionFrameworks, sharedGlossary } from "@se-simulator/shared-learning-assets";
import { getActiveStoryPhase } from "@se-simulator/story-mode";
import {
  developmentConsultations,
  developmentEvidenceGuides,
  developmentLearningObjective,
  developmentPlaybook,
  developmentProjectBrief,
  developmentProjectContext,
  developmentProjectDocuments,
  developmentStoryPhases,
  developmentSteps,
  type DevelopmentDecision,
} from "./scenario";

const skillLabels: Record<string, string> = {
  requirements: "要件定義",
  projectManagement: "プロジェクト管理",
  architecture: "アーキテクチャ設計",
  design: "設計",
  development: "実装",
  review: "レビュー",
  testing: "テスト",
  riskManagement: "リスク管理",
  operation: "運用",
  decisionMaking: "意思決定",
};

export function App() {
  const [stepIndex, setStepIndex] = useState(0);
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [responses, setResponses] = useState<DevelopmentDecision[]>([]);
  const [selectedEvidenceIndexes, setSelectedEvidenceIndexes] = useState<number[]>([]);
  const [rationale, setRationale] = useState("");
  const [consultation, setConsultation] = useState("");
  const [simulation, setSimulation] = useState<SimulationState>(() => createSimulationState("ec-product-search"));
  const [advice, setAdvice] = useState("");
  const [showReference, setShowReference] = useState(false);
  const currentStep = developmentSteps[Math.min(stepIndex, developmentSteps.length - 1)];
  const latestResponse = responses.find((response) => response.stepId === currentStep.id);
  const referencedDocuments = developmentProjectDocuments.filter((document) => currentStep.documentIds.includes(document.id));
  const activePhase = getActiveStoryPhase(developmentStoryPhases, stepIndex + 1);
  const recommendedConsultation = developmentConsultations[currentStep.id];
  const evidenceGuide = developmentEvidenceGuides[currentStep.id];
  const advisor = useMemo(() => createRuleBasedAdvisor(), []);
  const completed = responses.length === developmentSteps.length;
  const totalAssessment = calculateAssessment(responses.map(({ stepId, choice }) => ({
    dimension: developmentSteps.find((step) => step.id === stepId)?.skill ?? "projectManagement",
    points: choice.score,
    maxPoints: 3,
  })));
  const submitDecision = () => {
    if (!selectedChoiceId || selectedEvidenceIndexes.length === 0 || !rationale.trim() || !consultation.trim()) return;
    const choice = currentStep.choices.find((item) => item.id === selectedChoiceId);
    if (!choice) throw new Error(`選択した案が見つかりません: ${selectedChoiceId}`);
    const nextSimulation = recordSimulationEvent(simulation, {
      id: `decision-${currentStep.id}`,
      type: `decision:${currentStep.phase}`,
      occurredAt: Date.now(),
      payload: {
        stepId: currentStep.id,
        choiceId: choice.id,
        score: choice.score,
        evidence: selectedEvidenceIndexes.map((index) => currentStep.facts[index]),
        rationale: rationale.trim(),
        consultation: consultation.trim(),
      },
    });
    setSimulation(completeLearningObjective(nextSimulation, currentStep.id));
    setResponses((previous) => [...previous.filter((item) => item.stepId !== currentStep.id), {
      stepId: currentStep.id,
      choice,
      evidenceIndexes: [...selectedEvidenceIndexes],
      rationale: rationale.trim(),
      consultation: consultation.trim(),
    }]);
  };

  const goToStep = (index: number) => {
    const response = responses.find((item) => item.stepId === developmentSteps[index]?.id);
    setStepIndex(index);
    setSelectedChoiceId(response?.choice.id ?? null);
    setSelectedEvidenceIndexes(response?.evidenceIndexes ?? []);
    setRationale(response?.rationale ?? "");
    setConsultation(response?.consultation ?? "");
    setAdvice("");
  };

  const reset = () => {
    setStepIndex(0);
    setSelectedChoiceId(null);
    setSelectedEvidenceIndexes([]);
    setRationale("");
    setConsultation("");
    setResponses([]);
    setSimulation(createSimulationState("ec-product-search"));
    setAdvice("");
  };

  const requestAdvice = async () => {
    const evidence = latestResponse
      ? [
          ...latestResponse.evidenceIndexes.map((index) => currentStep.facts[index]),
          `判断理由: ${latestResponse.rationale}`,
          `相談・承認先: ${latestResponse.consultation}`,
        ]
      : currentStep.facts;
    const openQuestions = currentStep.facts.filter((fact) => /未合意|未定/.test(fact));
    setAdvice(await advisor.getAdvice({
      projectSummary: "ECサイトの商品検索機能を要件定義からリリースまで追加する",
      evidence,
      openQuestions,
      currentPhase: activePhase?.title,
    }));
  };

  const selectedChoice = currentStep.choices.find((choice) => choice.id === selectedChoiceId);

  return (
    <main className="development-app">
      <header className="topbar">
        <div className="brand"><div className="brand-mark">SE</div><div><strong>System Engineer Simulator Platform</strong><span>DEVELOPMENT PROJECT SIMULATOR · PREVIEW</span></div></div>
        <button className="quiet-button" onClick={() => setShowReference((shown) => !shown)}><BookOpen size={16} />用語・判断フレーム</button>
      </header>

      <div className="page-grid">
        <aside className="project-sidebar">
          <span className="eyebrow">PROJECT BRIEF</span>
          <h1>EC商品検索機能の追加</h1>
          <p>要件定義から運用引継ぎまで、顧客・開発・QA・運用の判断をつないで体験する案件演習です。</p>
          <div className="target-banner"><b>CASE STUDY · 対象: 新人〜中堅SE</b><span>{developmentLearningObjective.description}</span></div>
          <div className="brief-card"><span>利用者</span><strong>{developmentProjectBrief.users.toLocaleString()}人</strong></div>
          <div className="brief-card"><span>稼働条件</span><strong>{developmentProjectBrief.downtimeWindow}</strong></div>
          <div className="brief-card"><span>重要度</span><strong>{developmentProjectBrief.criticality}</strong></div>
          <details className="reference-card project-context">
            <summary>案件背景・成功条件</summary>
            <p>{developmentProjectContext.objective}</p>
            <p><b>期限:</b> {developmentProjectContext.schedule}</p>
            <p><b>体制:</b> {developmentProjectContext.team}</p>
            <strong>制約</strong>
            {developmentProjectContext.constraints.map((constraint) => <p key={constraint}>{constraint}</p>)}
            <strong>成功条件</strong>
            {developmentProjectContext.successCriteria.map((criterion) => <p key={criterion}>・{criterion}</p>)}
          </details>
          <section className="document-card current-documents">
            <span className="eyebrow">この工程の参照資料</span>
            {referencedDocuments.map((document) => (
              <article key={document.id}>
                <strong>{document.title}</strong>
                {document.sections.map((section) => <p key={section.id}><b>{section.title}:</b> {section.content}</p>)}
              </article>
            ))}
          </section>
          <details className="reference-card playbook">
            <summary>案件プレイブック（参照用）</summary>
            {developmentPlaybook.map((section) => (
              <article key={section.id}>
                <strong>{section.title}</strong>
                <p><b>確認:</b> {section.questions.join(" / ")}</p>
                <p><b>成果物:</b> {section.outputs.join(" / ")}</p>
                <p><b>レビュー:</b> {section.reviewPoints.join(" / ")}</p>
                <p><b>リスク:</b> {section.risks.join(" / ")}</p>
              </article>
            ))}
          </details>
          {showReference && <section className="reference-card"><strong>共通用語</strong>{sharedGlossary.slice(0, 4).map((entry) => <p key={entry.term}><b>{entry.term}</b> — {entry.definition}</p>)}<strong>判断フレーム</strong>{decisionFrameworks.map((framework) => <p key={framework.id}><b>{framework.title}</b> — {framework.purpose}</p>)}</section>}
          <div className="shared-packages"><span>共有エンジン利用中</span><small>案件管理 · 学習進行 · Advisor · Scoring · 学習資産</small></div>
        </aside>

        <section className="learning-panel">
          <div className="phase-track" aria-label="開発ライフサイクル">
            {developmentStoryPhases.map((phase, index) => <div key={phase.id} className={phase.id === activePhase?.id ? "active" : phase.endStep <= responses.length ? "complete" : ""}><i>{phase.endStep <= responses.length ? "✓" : index + 1}</i><span>{phase.title}</span></div>)}
          </div>
          {completed ? (
            <section className="completion-card">
              <div className="success-icon"><CheckCircle2 size={26} /></div><span className="eyebrow">PROJECT REVIEW</span>
              <h2>開発案件の振り返り</h2>
              <p>顧客要望から運用引継ぎまで、{developmentSteps.length}つの判断を完了しました。点数は設定条件に対する学習用ルーブリックであり、実務能力の認定ではありません。</p>
              <div className="score-grid"><article><span>判断ポイント</span><strong>{responses.reduce((sum, item) => sum + item.choice.score, 0)} / {developmentSteps.length * 3}</strong></article><article><span>総合適合度</span><strong>{totalAssessment.total.percentage ?? 0}%</strong></article><article><span>記録イベント</span><strong>{simulation.events.length}</strong></article></div>
              <h3>案件を通した流れ</h3>
              <ol className="review-flow">{developmentStoryPhases.map((phase) => <li key={phase.id}><strong>{phase.title}</strong><span>{developmentSteps.slice(phase.startStep - 1, phase.endStep).map((step) => step.title).join(" → ")}</span></li>)}</ol>
              <h3>身につけたSEスキル</h3>
              <div className="skill-list">{Object.entries(totalAssessment.dimensions).map(([skill, score]) => <span key={skill}>{skillLabels[skill] ?? skill} · {score.percentage}%</span>)}</div>
              <h3>次の案件に持ち帰ること</h3>
              <ul className="takeaway-list">
                <li>要望を、利用者の課題・受入条件・対象外範囲に分けて合意する。</li>
                <li>不確実な性能やデータ品質は早期に計測し、見積・公開判断を更新する。</li>
                <li>既存利用者との互換性、運用責任、停止条件までリリースの完成条件に含める。</li>
              </ul>
              <h3>自分の判断理由を振り返る</h3>
              <ol className="decision-review-list">{responses.map((response) => {
                const step = developmentSteps.find((item) => item.id === response.stepId);
                return <li key={response.stepId}><strong>{step?.title}</strong><span>根拠: {response.evidenceIndexes.map((index) => step?.facts[index]).join(" / ")}</span><span>理由: {response.rationale}</span><span>相談・承認先: {response.consultation}</span></li>;
              })}</ol>
              <button className="primary-button" onClick={reset}><RotateCcw size={16} />もう一度演習する</button>
            </section>
          ) : (
            <>
              <div className="step-heading"><div><span className="eyebrow">{activePhase?.title} · STEP {stepIndex + 1} / {developmentSteps.length}</span><h2>{currentStep.title}</h2></div><span className="skill-badge">{skillLabels[currentStep.skill] ?? currentStep.skill}</span></div>
              <div className="situation-card"><strong>案件の状況</strong><p>{currentStep.situation}</p></div>
              <div className="facts-card"><strong>この判断時点で分かっていること</strong><ul>{currentStep.facts.map((fact) => <li key={fact}>{fact}</li>)}</ul></div>
              <div className="judgment-card"><strong>判断時に見る観点</strong><ul>{currentStep.judgmentPoints.map((point) => <li key={point}>{point}</li>)}</ul></div>
              <section className="decision-card">
                <span className="eyebrow">判断ポイント</span><h3>{currentStep.question}</h3>
                <div className="choice-list">{currentStep.choices.map((choice, index) => <label key={choice.id} className={`choice ${selectedChoiceId === choice.id ? "selected" : ""}`}><input type="radio" name={currentStep.id} checked={selectedChoiceId === choice.id} disabled={Boolean(latestResponse)} onChange={() => setSelectedChoiceId(choice.id)} /><span className="choice-marker">{String.fromCharCode(65 + index)}</span><span>{choice.label}</span></label>)}</div>
                {!latestResponse && <div className="reasoning-form">
                  <strong>判断根拠に使う案件条件</strong>
                  <div className="evidence-checklist">{currentStep.facts.map((fact, index) => <label key={fact}><input type="checkbox" checked={selectedEvidenceIndexes.includes(index)} onChange={() => setSelectedEvidenceIndexes((previous) => previous.includes(index) ? previous.filter((item) => item !== index) : [...previous, index])} />{fact}</label>)}</div>
                  <label className="field-label">この条件から、なぜその案を選びましたか？<textarea value={rationale} onChange={(event) => setRationale(event.target.value)} placeholder="重視した条件、残るリスク、判断の前提を短く説明してください" /></label>
                  <label className="field-label">誰に相談・承認を取りに行きますか？<input value={consultation} onChange={(event) => setConsultation(event.target.value)} placeholder={recommendedConsultation.role} /></label>
                  <p className="consultation-hint"><b>相談ポイント:</b> {recommendedConsultation.reason}</p>
                </div>}
                {!latestResponse ? <button className="primary-button" disabled={!selectedChoice || selectedEvidenceIndexes.length === 0 || !rationale.trim() || !consultation.trim()} onClick={submitDecision}>判断を記録する <ArrowRight size={16} /></button> : <div className={`feedback ${latestResponse.choice.score === 3 ? "positive" : latestResponse.choice.score <= 1 ? "warning" : ""}`}><strong>{latestResponse.choice.score === 3 ? "この案件条件に適合度の高い判断です" : latestResponse.choice.score <= 1 ? "重要なリスクが残る判断です" : "成立する判断ですが、条件の確認が必要です"}</strong><p>{latestResponse.choice.feedback}</p><div><b>利点:</b> {latestResponse.choice.benefit}</div><div><b>残るリスク:</b> {latestResponse.choice.risk}</div><div className="decision-outcome"><b>この判断の結果:</b> {latestResponse.choice.outcome}</div><div className="reasoning-review"><b>あなたの根拠:</b> {latestResponse.evidenceIndexes.map((index) => currentStep.facts[index]).join(" / ")}<br /><b>判断理由:</b> {latestResponse.rationale}<br /><b>相談・承認先:</b> {latestResponse.consultation}</div><div className="evidence-feedback"><b>根拠チェック:</b> {latestResponse.evidenceIndexes.filter((index) => evidenceGuide.expectedIndexes.includes(index)).length} / {evidenceGuide.expectedIndexes.length} の重点材料を選択。{evidenceGuide.explanation}<br /><b>推奨する相談先:</b> {recommendedConsultation.role} — {recommendedConsultation.reason}<br /><span>自由記述の文章内容は自動採点せず、根拠・理由・相談先を利用者が振り返る証跡として記録します。</span></div><div className="handoff"><b>次工程への引継ぎ:</b> {currentStep.handoff}</div><button className="quiet-button advisor-button" onClick={requestAdvice}><ShieldCheck size={15} />上司に相談</button>{advice && <pre className="advice">{advice}</pre>}</div>}
              </section>
              <footer className="step-footer"><button className="quiet-button" disabled={stepIndex === 0} onClick={() => goToStep(stepIndex - 1)}><ArrowLeft size={15} />前の工程</button><span><ClipboardCheck size={15} />回答はこの演習セッション内で記録されます</span><button className="primary-button" disabled={!latestResponse} onClick={() => stepIndex === developmentSteps.length - 1 ? setStepIndex(developmentSteps.length) : goToStep(stepIndex + 1)}>次の工程 <ArrowRight size={16} /></button></footer>
            </>
          )}
        </section>
      </div>
      <div className="safety-note"><AlertTriangle size={14} />本アプリは教育用プレビューです。コードや外部システムを実行・変更しません。</div>
    </main>
  );
}
