import { useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  Lightbulb,
  RotateCcw,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  calculateCaseJudgmentScores,
  caseGlossary,
  caseJudgmentDimensions,
  caseStudyDifficultyGuides,
  getCaseStudies,
  shuffleCaseStudies,
  type CaseJudgmentDimension,
  type CaseQuestion,
  type CaseStudyAnswer,
  type CaseStudyDifficulty,
  type CaseStudyScenario,
} from "../domain/case-studies";

type PlayerPhase = "question" | "review" | "summary";

const difficultyLabels: Record<CaseStudyDifficulty, string> = {
  easy: "初級",
  normal: "標準",
  hard: "上級",
};

const dimensionLabels: Record<CaseJudgmentDimension, string> = {
  technicalJudge: "技術判断",
  operationJudge: "運用判断",
  riskJudge: "リスク管理",
  communicationJudge: "関係者調整",
  rollbackJudge: "切戻し判断",
};

export function CaseStudyPlayer({
  difficulty,
  onClose,
}: {
  difficulty: CaseStudyDifficulty;
  onClose: () => void;
}) {
  const [deck, setDeck] = useState(() => shuffleCaseStudies(getCaseStudies(difficulty)));
  const [caseIndex, setCaseIndex] = useState(0);
  const [phase, setPhase] = useState<PlayerPhase>("question");
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const [selectedRationaleFactors, setSelectedRationaleFactors] = useState<string[]>([]);
  const [openGlossaryTerm, setOpenGlossaryTerm] = useState<string | null>(null);
  const [answers, setAnswers] = useState<CaseStudyAnswer[]>([]);
  const [rationale, setRationale] = useState("");

  const currentCase = deck[caseIndex];
  if (!currentCase) throw new Error(`問題集に案件がありません: ${difficulty}`);
  const question = currentCase.questions[0];
  if (!question) throw new Error(`設問がありません: ${currentCase.id}`);
  const latestAnswer = answers.find((answer) => answer.caseId === currentCase.id);
  const score = calculateCaseJudgmentScores(answers);
  const points = answers.reduce((total, answer) => total + answer.fit, 0);
  const maxPoints = answers.length * 3;

  const chooseAnswer = (choiceIndex: number) => {
    setSelectedAnswers([choiceIndex]);
  };

  const submitAnswer = () => {
    if (selectedAnswers.length === 0) return;
    const choiceIndex = selectedAnswers[0];
    const fit = question.choiceReviews[choiceIndex]?.fit;
    if (fit === undefined) throw new Error(`選択肢の評価がありません: ${currentCase.id}/${choiceIndex}`);
    setAnswers((previous) => [
      ...previous.filter((answer) => answer.caseId !== currentCase.id),
      {
        caseId: currentCase.id,
        judgmentDimension: question.judgmentDimension,
        choiceIndex,
        fit,
        rationaleFactors: selectedRationaleFactors,
        rationale: "",
      },
    ]);
    setPhase("review");
  };

  const continueToNextCase = () => {
    if (caseIndex >= deck.length - 1) {
      setPhase("summary");
      return;
    }
    setCaseIndex((previous) => previous + 1);
    setSelectedAnswers([]);
    setSelectedRationaleFactors([]);
    setOpenGlossaryTerm(null);
    setRationale("");
    setPhase("question");
  };

  const updateRationale = (value: string) => {
    setRationale(value);
    setAnswers((previous) => previous.map((answer) => answer.caseId === currentCase.id
      ? { ...answer, rationale: value }
      : answer));
  };

  const updateRationaleFactors = (factors: string[]) => {
    setSelectedRationaleFactors(factors);
    setAnswers((previous) => previous.map((answer) => answer.caseId === currentCase.id
      ? { ...answer, rationaleFactors: factors }
      : answer));
  };

  const toggleGlossary = (term: string) => {
    setOpenGlossaryTerm((previous) => previous === term ? null : term);
  };

  const startNewRound = () => {
    setDeck(shuffleCaseStudies(getCaseStudies(difficulty)));
    setCaseIndex(0);
    setAnswers([]);
    setSelectedAnswers([]);
    setSelectedRationaleFactors([]);
    setOpenGlossaryTerm(null);
    setRationale("");
    setPhase("question");
  };

  return (
    <div className="case-study-overlay">
      <section className="case-study-player" role="dialog" aria-modal="true" aria-label="問題集モード">
        <header className="case-study-header">
          <div className="case-study-brand">
            <div className="case-study-brand-icon"><BookOpen size={19} /></div>
            <div>
              <strong>CASE STUDY <span>MODE</span></strong>
              <small>案件判断の経験を積む</small>
            </div>
          </div>
          <div className="case-study-session-status">
            {phase !== "summary" && <span>案件 {caseIndex + 1} / {deck.length}</span>}
            <span>{difficultyLabels[difficulty]}</span>
            {answers.length > 0 && <button onClick={() => setPhase("summary")}>成績を見る</button>}
            <button className="case-study-close" onClick={onClose} aria-label="問題集を終了"><X size={19} /></button>
          </div>
        </header>

        <div className="case-study-progress" aria-label={`案件 ${Math.min(caseIndex + 1, deck.length)} / ${deck.length}`}>
          <div style={{ width: `${(answers.length / deck.length) * 100}%` }} />
        </div>

        <main className="case-study-content">
          {phase === "summary" ? (
            <CaseStudySummary
              difficulty={difficulty}
              answers={answers}
              score={score}
              points={points}
              maxPoints={maxPoints}
              rationaleCount={answers.filter((answer) => answer.rationale.trim() || answer.rationaleFactors.length > 0).length}
              deckSize={deck.length}
              onRestart={startNewRound}
              onClose={onClose}
            />
          ) : (
            <>
              <div className="case-study-case-heading">
                <span className="case-study-category">{currentCase.category}</span>
                <span className={`case-study-phase-label ${phase}`}>{phase === "question" ? "案件判断" : "振り返り"}</span>
                <h1>{currentCase.title}</h1>
                <p>{currentCase.background}</p>
              </div>

              {phase === "question" && (
                <div className="case-study-decision-screen">
                  <CaseConditions scenario={currentCase} />
                  <QuestionPanel
                    question={question}
                    difficulty={currentCase.difficulty}
                    selectedAnswers={selectedAnswers}
                    onChoose={chooseAnswer}
                    onSubmit={submitAnswer}
                  />
                </div>
              )}

              {phase === "review" && latestAnswer && (
                <CaseReview
                  scenario={currentCase}
                  question={question}
                  answer={latestAnswer}
                  selectedRationaleFactors={selectedRationaleFactors}
                  rationale={rationale}
                  openGlossaryTerm={openGlossaryTerm}
                  onRationaleFactorsChange={updateRationaleFactors}
                  onRationaleChange={updateRationale}
                  onGlossaryToggle={toggleGlossary}
                  onNext={continueToNextCase}
                  isLastCase={caseIndex === deck.length - 1}
                />
              )}
            </>
          )}
        </main>
      </section>
    </div>
  );
}

function CaseConditions({ scenario }: { scenario: CaseStudyScenario }) {
  return (
    <section className="case-study-conditions" aria-label="案件条件">
      <h2>案件条件</h2>
      <div className="case-study-condition-grid">
        <Condition label="利用者" value={`${scenario.conditions.users.toLocaleString()}人`} />
        <Condition label="停止可能時間" value={`${scenario.conditions.downtimeMinutes}分`} />
        <Condition label="システム" value={scenario.conditions.systemType} />
        {scenario.conditions.databases?.map((database) => <Condition key={database} label="DB" value={database} />)}
      </div>
      {scenario.conditions.details.length > 0 && (
        <ul className="case-study-facts">
          {scenario.conditions.details.map((detail) => <li key={detail}>{detail}</li>)}
        </ul>
      )}
      {scenario.conditions.dependencies && scenario.conditions.dependencies.length > 0 && (
        <div className="case-study-dependencies">
          <strong>関連する依存先</strong>
          <div>{scenario.conditions.dependencies.map((dependency) => <span key={dependency}>{dependency}</span>)}</div>
        </div>
      )}
    </section>
  );
}

function Condition({ label, value }: { label: string; value: string }) {
  return <article><span>{label}</span><strong>{value}</strong></article>;
}

function QuestionPanel({
  question,
  difficulty,
  selectedAnswers,
  onChoose,
  onSubmit,
}: {
  question: CaseQuestion;
  difficulty: CaseStudyDifficulty;
  selectedAnswers: number[];
  onChoose: (choiceIndex: number) => void;
  onSubmit: () => void;
}) {
  return (
    <section className="case-study-question-panel">
      <div className="case-study-question-title">
        <span>設問</span>
        <small>利点とコストを比較し、条件に最も合う案を選択</small>
      </div>
      <div className={`case-study-difficulty-guide ${difficulty}`}>
        <strong>{difficultyLabels[difficulty]}で身につける判断</strong>
        <p>{caseStudyDifficultyGuides[difficulty]}</p>
      </div>
      <h2>{question.question}</h2>
      <div className="case-study-choices">
        {question.choices.map((choice, index) => {
          const selected = selectedAnswers.includes(index);
          return (
            <label
              key={choice}
              className={`case-study-choice ${selected ? "selected" : ""}`}
            >
              <input
                type="radio"
                name={`case-question-${question.id}`}
                checked={selected}
                onChange={() => onChoose(index)}
              />
              <span className="case-study-choice-marker">{selected ? <Check size={15} /> : String.fromCharCode(65 + index)}</span>
              <span>{choice}</span>
            </label>
          );
        })}
      </div>
      <div className="case-study-action-row">
        <span>すべての選択肢に利点とコストがあります。唯一の正解探しではなく、条件との適合性を比べます。</span>
        <button className="case-study-primary" disabled={selectedAnswers.length === 0} onClick={onSubmit}>
          判断を確認 <ArrowRight size={16} />
        </button>
      </div>
    </section>
  );
}

function CaseReview({
  scenario,
  question,
  answer,
  selectedRationaleFactors,
  rationale,
  openGlossaryTerm,
  onRationaleFactorsChange,
  onRationaleChange,
  onGlossaryToggle,
  onNext,
  isLastCase,
}: {
  scenario: CaseStudyScenario;
  question: CaseQuestion;
  answer: CaseStudyAnswer;
  selectedRationaleFactors: string[];
  rationale: string;
  openGlossaryTerm: string | null;
  onRationaleFactorsChange: (factors: string[]) => void;
  onRationaleChange: (value: string) => void;
  onGlossaryToggle: (term: string) => void;
  onNext: () => void;
  isLastCase: boolean;
}) {
  const selectedReview = question.choiceReviews[answer.choiceIndex];
  if (!selectedReview) throw new Error(`回答した選択肢の評価がありません: ${answer.caseId}`);
  const bestFit = Math.max(...question.choiceReviews.map(({ fit }) => fit));
  const bestAlternativeIndex = question.highestFitChoices.find((index) => index !== answer.choiceIndex)
    ?? question.highestFitChoices[0];
  const bestAlternative = question.choices[bestAlternativeIndex];
  const bestAlternativeReview = question.choiceReviews[bestAlternativeIndex];
  if (!bestAlternative || !bestAlternativeReview) {
    throw new Error(`比較する選択肢がありません: ${question.id}`);
  }
  const followUpAction = scenario.difficulty === "hard"
    ? "判断期限・影響閾値・代替策をGo/No-Go条件として合意"
    : scenario.difficulty === "normal"
      ? "担当者・期限・合格条件を決めて証跡を残す"
      : "確認結果を記録し、次の作業へ進む条件を明確にする";
  const caseFacts = scenario.conditions.details.slice(0, 2);
  const caseContext = caseFacts.length > 0
    ? `この案件では「${caseFacts.join("」「")}」が判断材料です。`
    : `利用者${scenario.conditions.users.toLocaleString()}人、停止可能時間${scenario.conditions.downtimeMinutes}分の条件です。`;
  const personalizedReview = answer.fit === bestFit
    ? `${caseContext}選んだ案の利点は「${selectedReview.benefit}」ですが、「${selectedReview.cost}」は残ります。${followUpAction}してから実行しましょう。`
    : `${caseContext}選んだ案には「${selectedReview.cost}」が残ります。条件に最も適合する比較案「${bestAlternative}」は「${bestAlternativeReview.benefit}」を得られます。選んだ案を採る場合は、残るリスクを受容する根拠と承認者を明確にしてください。`;
  const toggleRationaleFactor = (factor: string) => {
    onRationaleFactorsChange(selectedRationaleFactors.includes(factor)
      ? selectedRationaleFactors.filter((item) => item !== factor)
      : [...selectedRationaleFactors, factor]);
  };
  const definitions = caseGlossary.filter(({ term }) => question.glossaryTerms.includes(term));
  return (
    <section className="case-study-review">
      <div className={`case-study-verdict ${answer.fit >= 3 ? "correct" : answer.fit <= 1 ? "incorrect" : "balanced"}`}>
        {answer.fit >= 3 ? <CheckCircle2 size={21} /> : answer.fit <= 1 ? <AlertTriangle size={21} /> : <Lightbulb size={21} />}
        <div>
          <strong>{answer.fit >= 3 ? "条件に良く合った判断です" : answer.fit === 2 ? "成立する選択肢ですが、別のコストもあります" : "この条件では別案の方がリスクを抑えられます"}</strong>
          <span>条件適合度 {answer.fit} / 3 · 評価領域: {dimensionLabels[question.judgmentDimension]}</span>
        </div>
      </div>

      {answer.fit <= 1
        ? <FailureSimulation question={question} />
        : <article className="case-study-consequence good">
          <strong>今回の選択で得られること / 引き受けるコスト</strong>
          <p><b>利点:</b> {selectedReview.benefit}</p>
          <p><b>注意点:</b> {selectedReview.cost}</p>
        </article>}

      <article className="case-study-explanation">
        <div className="case-study-section-icon"><Lightbulb size={17} /></div>
        <div><h2>解説</h2><p>{question.explanation}</p></div>
      </article>

      <section className="case-study-review-basis" aria-label="判断材料">
        <h2>今回の判断材料</h2>
        <div>{question.reviewBasis.map((fact) => <span key={fact}>{fact}</span>)}</div>
      </section>

      {question.rehearsal && <section className="case-study-rehearsal">
        <strong>リハーサル結果</strong>
        <p>{question.rehearsal.result}</p>
        <p>{question.rehearsal.implication}</p>
      </section>}

      <section className="case-study-option-comparison">
        <h2>選択肢のトレードオフ比較</h2>
        {question.choices.map((choice, index) => {
          const review = question.choiceReviews[index];
          const chosen = index === answer.choiceIndex;
          if (!review) throw new Error(`選択肢の比較情報がありません: ${question.id}/${index}`);
          return <article className={chosen ? "chosen" : ""} key={choice}>
            <header><strong>{String.fromCharCode(65 + index)} · {chosen ? "あなたの選択" : "比較案"}</strong><span>適合度 {review.fit} / 3</span></header>
            <p>{choice}</p>
            <div><span><b>利点:</b> {review.benefit}</span><span><b>コスト・リスク:</b> {review.cost}</span></div>
          </article>;
        })}
      </section>

      <article className="case-study-senior-review">
        <div className="case-study-section-icon"><ShieldCheck size={17} /></div>
        <div>
          <h2>ベテランSEレビュー</h2>
          <p>{personalizedReview}</p>
        </div>
      </article>

      <fieldset className="case-study-rationale-factors">
        <legend>どの情報を重視しましたか？ <small>任意・複数選択可</small></legend>
        <div>{question.rationaleFactors.map((factor) => <label key={factor}>
          <input type="checkbox" checked={selectedRationaleFactors.includes(factor)} onChange={() => toggleRationaleFactor(factor)} />
          <span>{factor}</span>
        </label>)}</div>
      </fieldset>
      <label className="case-study-rationale">
        <span>判断理由をひとこと <small>任意</small></span>
        <textarea value={rationale} onChange={(event) => onRationaleChange(event.target.value)} placeholder="例: 利用者が多く停止枠が短いため、切戻し可能性と影響範囲を重視した" rows={2} />
      </label>

      {definitions.length > 0 && <section className="case-study-glossary">
        <h2>用語カード</h2>
        <div>{definitions.map((entry) => <button key={entry.term} className={openGlossaryTerm === entry.term ? "active" : ""} onClick={() => onGlossaryToggle(entry.term)}>{entry.term}</button>)}</div>
        {definitions.map((entry) => openGlossaryTerm === entry.term && <article key={entry.term}><strong>{entry.term}</strong><p>{entry.definition}</p></article>)}
      </section>}

      <div className="case-study-action-row">
        <span>判断の適合度と理由は「{dimensionLabels[question.judgmentDimension]}」として集計されます。</span>
        <button className="case-study-primary" onClick={onNext}>
          {isLastCase ? "成績を見る" : "次の案件"} <ArrowRight size={16} />
        </button>
      </div>
    </section>
  );
}

function FailureSimulation({ question }: { question: CaseQuestion }) {
  return (
    <article className="case-study-failure">
      <div className="case-study-failure-heading"><AlertTriangle size={19} /><div><span>この案でリスクが顕在化した場合のシミュレーション</span><strong>{question.failureScenario.title}</strong></div></div>
      <p>{question.failureScenario.description}</p>
      <div className="case-study-failure-flow" aria-label="障害の流れ">
        {question.failureScenario.flow.map((step, index) => (
          <span key={`${step}-${index}`}>{index > 0 && <ArrowRight size={14} aria-hidden="true" />}{step}</span>
        ))}
      </div>
      <strong className="case-study-impact-label">想定される影響</strong>
      <p>{question.failureScenario.impact} {question.consequenceBad}</p>
    </article>
  );
}

function CaseStudySummary({
  difficulty,
  answers,
  score,
  points,
  maxPoints,
  rationaleCount,
  deckSize,
  onRestart,
  onClose,
}: {
  difficulty: CaseStudyDifficulty;
  answers: CaseStudyAnswer[];
  score: ReturnType<typeof calculateCaseJudgmentScores>;
  points: number;
  maxPoints: number;
  rationaleCount: number;
  deckSize: number;
  onRestart: () => void;
  onClose: () => void;
}) {
  const completed = answers.length === deckSize;
  return (
    <section className="case-study-summary">
      <span className="case-study-summary-eyebrow">CASE STUDY · REVIEW</span>
      <h1>{completed ? "案件演習の振り返り" : "ここまでの判断を振り返る"}</h1>
      <p>{completed
        ? `${difficultyLabels[difficulty]}の案件をすべて確認しました。判断領域ごとの適合度と理由を振り返りましょう。`
        : "未回答の案件は次回の開始時に再度出題されます。今回の回答を確認しましょう。"}</p>

      <div className="case-study-total-score">
        <div><span>回答した案件</span><strong>{answers.length} / {deckSize}</strong></div>
        <div><span>判断ポイント</span><strong>{points} / {maxPoints}</strong></div>
        <div><span>平均適合度</span><strong>{answers.length ? `${Math.round((points / answers.length) * 10) / 10} / 3` : "—"}</strong></div>
        <div><span>根拠を記録</span><strong>{rationaleCount} / {answers.length}</strong></div>
      </div>

      <section className="case-study-dimension-scores">
        <h2>判断領域別スコア</h2>
        <div>
          {caseJudgmentDimensions.map(({ id, title }) => {
            const item = score[id];
            return (
              <article key={id}>
                <div><strong>{title}</strong><span>{item.percentage === null ? "未回答" : `${item.percentage}% · ${item.points}/${item.maxPoints}`}</span></div>
                <div className="case-study-score-track"><span style={{ width: `${item.percentage ?? 0}%` }} /></div>
              </article>
            );
          })}
        </div>
      </section>

      <p className="case-study-score-note">スコアは案件条件に対する判断の相対的な適合度（0〜3）です。最高点が常に唯一の正解という意味ではなく、制約や関係者合意によって実務上の選択は変わります。</p>
      <div className="case-study-action-row">
        <button className="case-study-secondary" onClick={onClose}><ArrowLeft size={15} /> デスクトップへ戻る</button>
        <button className="case-study-primary" onClick={onRestart}><RotateCcw size={15} /> 同じ難易度でもう一周</button>
      </div>
    </section>
  );
}
