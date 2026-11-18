import { useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, BookOpen, CheckCircle2, ClipboardCheck, RotateCcw, ShieldCheck } from "lucide-react";
import { createRuleBasedAdvisor } from "@se-simulator/advisor-engine";
import { calculateCaseJudgmentScores, caseJudgmentDimensions, type CaseStudyAnswer } from "@se-simulator/case-study-mode";
import type { ProjectDocument } from "@se-simulator/project-desk";
import { calculateAssessment } from "@se-simulator/scoring-engine";
import { completeLearningObjective, createSimulationState, recordSimulationEvent, type SimulationState } from "@se-simulator/shared-engine";
import { decisionFrameworks, sharedGlossary } from "@se-simulator/shared-learning-assets";
import { getActiveStoryPhase } from "@se-simulator/story-mode";
import { developmentProjectBrief, developmentProjectDocuments, developmentStoryPhases, developmentSteps, type DevelopmentChoice } from "./scenario";

export function App() {
  const [stepIndex, setStepIndex] = useState(0);
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [responses, setResponses] = useState<Array<{ stepId: string; choice: DevelopmentChoice }>>([]);
  const [simulation, setSimulation] = useState<SimulationState>(() => createSimulationState("ec-product-search"));
  const [advice, setAdvice] = useState("");
  const [showReference, setShowReference] = useState(false);
  const currentStep = developmentSteps[stepIndex];
  const latestResponse = responses.find((response) => response.stepId === currentStep.id);
  const activePhase = getActiveStoryPhase(developmentStoryPhases, stepIndex + 1);
  const advisor = useMemo(() => createRuleBasedAdvisor(), []);
  const completed = responses.length === developmentSteps.length;
  const totalAssessment = calculateAssessment(responses.map(({ stepId, choice }) => ({
    dimension: developmentSteps.find((step) => step.id === stepId)?.skill ?? "projectManagement",
    points: choice.score,
    maxPoints: 3,
  })));
  const caseAnswers: CaseStudyAnswer[] = responses.map(({ stepId, choice }) => ({
    caseId: stepId,
    judgmentDimension: "technicalJudge",
    choiceIndex: 0,
    fit: choice.score,
    rationaleFactors: [],
    rationale: "",
  }));
  const tradeoffScores = calculateCaseJudgmentScores(caseAnswers);

  const submitDecision = () => {
    if (!selectedChoiceId) return;
    const choice = currentStep.choices.find((item) => item.id === selectedChoiceId);
    if (!choice) throw new Error(`選択した案が見つかりません: ${selectedChoiceId}`);
    const nextSimulation = recordSimulationEvent(simulation, {
      id: `decision-${currentStep.id}`,
      type: `decision:${currentStep.phase}`,
      occurredAt: Date.now(),
      payload: { stepId: currentStep.id, choiceId: choice.id, score: choice.score },
    });
    setSimulation(completeLearningObjective(nextSimulation, currentStep.id));
    setResponses((previous) => [...previous.filter((item) => item.stepId !== currentStep.id), { stepId: currentStep.id, choice }]);
  };

  const goToStep = (index: number) => {
    setStepIndex(index);
    setSelectedChoiceId(null);
    setAdvice("");
  };

  const reset = () => {
    setStepIndex(0);
    setSelectedChoiceId(null);
    setResponses([]);
    setSimulation(createSimulationState("ec-product-search"));
    setAdvice("");
  };

  const requestAdvice = async () => {
    const evidence = latestResponse ? [latestResponse.choice.feedback] : currentStep.facts;
    const openQuestions = currentStep.facts.filter((fact) => /未合意|未定/.test(fact));
    setAdvice(await advisor.getAdvice({
      projectSummary: "ECサイトの商品検索機能を要件定義からリリースまで追加する",
      evidence,
      openQuestions,
      currentPhase: activePhase?.title,
    }));
  };

  const selectedProjectDocument: ProjectDocument | undefined = developmentProjectDocuments[0];
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
          <p>顧客の要望を確認し、設計・実装・テスト・リリース判断を進める短編演習です。</p>
          <div className="brief-card"><span>利用者</span><strong>{developmentProjectBrief.users.toLocaleString()}人</strong></div>
          <div className="brief-card"><span>稼働条件</span><strong>{developmentProjectBrief.downtimeWindow}</strong></div>
          <div className="brief-card"><span>重要度</span><strong>{developmentProjectBrief.criticality}</strong></div>
          {selectedProjectDocument && <section className="document-card"><span className="eyebrow">案件資料</span><strong>{selectedProjectDocument.title}</strong><p>{selectedProjectDocument.sections[0]?.content}</p><small>{selectedProjectDocument.sections[1]?.content}</small></section>}
          {showReference && <section className="reference-card"><strong>共通用語</strong>{sharedGlossary.slice(0, 4).map((entry) => <p key={entry.term}><b>{entry.term}</b> — {entry.definition}</p>)}<strong>判断フレーム</strong>{decisionFrameworks.map((framework) => <p key={framework.id}><b>{framework.title}</b> — {framework.purpose}</p>)}</section>}
          <div className="shared-packages"><span>共有エンジン利用中</span><small>案件管理 · Story · Case Study · Advisor · Scoring</small></div>
        </aside>

        <section className="learning-panel">
          <div className="phase-track" aria-label="開発ライフサイクル">
            {developmentStoryPhases.map((phase, index) => <div key={phase.id} className={phase.id === activePhase?.id ? "active" : phase.endStep <= responses.length ? "complete" : ""}><i>{phase.endStep <= responses.length ? "✓" : index + 1}</i><span>{phase.title}</span></div>)}
          </div>
          {completed ? (
            <section className="completion-card">
              <div className="success-icon"><CheckCircle2 size={26} /></div><span className="eyebrow">PROJECT REVIEW</span>
              <h2>開発案件の振り返り</h2>
              <p>要件確認からリリースまで、6つの判断を完了しました。演習の得点は学習用のルーブリック評価であり、実務能力の認定ではありません。</p>
              <div className="score-grid"><article><span>判断ポイント</span><strong>{responses.reduce((sum, item) => sum + item.choice.score, 0)} / {developmentSteps.length * 3}</strong></article><article><span>総合適合度</span><strong>{totalAssessment.total.percentage ?? 0}%</strong></article><article><span>記録イベント</span><strong>{simulation.events.length}</strong></article></div>
              <h3>身につけたSEスキル</h3>
              <div className="skill-list">{Object.entries(totalAssessment.dimensions).map(([skill, score]) => <span key={skill}>{skill} · {score.percentage}%</span>)}</div>
              <p className="note">案件判断領域の参考値: {caseJudgmentDimensions.find(({ id }) => id === "technicalJudge")?.title} {tradeoffScores.technicalJudge.percentage ?? 0}%</p>
              <button className="primary-button" onClick={reset}><RotateCcw size={16} />もう一度演習する</button>
            </section>
          ) : (
            <>
              <div className="step-heading"><div><span className="eyebrow">{activePhase?.title} · STEP {stepIndex + 1} / {developmentSteps.length}</span><h2>{currentStep.title}</h2></div><span className="skill-badge">{currentStep.skill}</span></div>
              <div className="facts-card"><strong>案件で確認できていること</strong><ul>{currentStep.facts.map((fact) => <li key={fact}>{fact}</li>)}</ul></div>
              <section className="decision-card">
                <span className="eyebrow">判断ポイント</span><h3>{currentStep.question}</h3>
                <div className="choice-list">{currentStep.choices.map((choice, index) => <label key={choice.id} className={`choice ${selectedChoiceId === choice.id ? "selected" : ""}`}><input type="radio" name={currentStep.id} checked={selectedChoiceId === choice.id} disabled={Boolean(latestResponse)} onChange={() => setSelectedChoiceId(choice.id)} /><span className="choice-marker">{String.fromCharCode(65 + index)}</span><span>{choice.label}</span></label>)}</div>
                {!latestResponse ? <button className="primary-button" disabled={!selectedChoice} onClick={submitDecision}>この判断で進む <ArrowRight size={16} /></button> : <div className={`feedback ${latestResponse.choice.score === 3 ? "positive" : latestResponse.choice.score === 0 ? "warning" : ""}`}><strong>{latestResponse.choice.score === 3 ? "条件に合った判断です" : latestResponse.choice.score === 0 ? "見落としたリスクがあります" : "成立する案ですが、確認が残ります"}</strong><p>{latestResponse.choice.feedback}</p><div><b>利点:</b> {latestResponse.choice.benefit}</div><div><b>残るリスク:</b> {latestResponse.choice.risk}</div><button className="quiet-button advisor-button" onClick={requestAdvice}><ShieldCheck size={15} />上司に相談</button>{advice && <pre className="advice">{advice}</pre>}</div>}
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
