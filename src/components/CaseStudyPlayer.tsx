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
  caseJudgmentDimensions,
  getCaseStudies,
  shuffleCaseStudies,
  type CaseJudgmentDimension,
  type CaseQuestion,
  type CaseStudyAnswer,
  type CaseStudyDifficulty,
  type CaseStudyScenario,
} from "../domain/case-studies";

type PlayerPhase = "overview" | "question" | "review" | "summary";

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

function isCorrectAnswer(selected: number[], correct: number[]): boolean {
  const selectedSorted = [...selected].sort((a, b) => a - b);
  const correctSorted = [...correct].sort((a, b) => a - b);
  return selectedSorted.length === correctSorted.length
    && selectedSorted.every((answer, index) => answer === correctSorted[index]);
}

export function CaseStudyPlayer({
  difficulty,
  onClose,
}: {
  difficulty: CaseStudyDifficulty;
  onClose: () => void;
}) {
  const [deck, setDeck] = useState(() => shuffleCaseStudies(getCaseStudies(difficulty)));
  const [caseIndex, setCaseIndex] = useState(0);
  const [phase, setPhase] = useState<PlayerPhase>("overview");
  const [selectedAnswers, setSelectedAnswers] = useState<number[]>([]);
  const [answers, setAnswers] = useState<CaseStudyAnswer[]>([]);
  const [rationale, setRationale] = useState("");

  const currentCase = deck[caseIndex];
  if (!currentCase) throw new Error(`問題集に案件がありません: ${difficulty}`);
  const question = currentCase.questions[0];
  if (!question) throw new Error(`設問がありません: ${currentCase.id}`);
  const latestAnswer = answers.find((answer) => answer.caseId === currentCase.id);
  const score = calculateCaseJudgmentScores(answers);
  const correctCount = answers.filter((answer) => answer.correct).length;

  const toggleAnswer = (choiceIndex: number) => {
    setSelectedAnswers((previous) => previous.includes(choiceIndex)
      ? previous.filter((item) => item !== choiceIndex)
      : [...previous, choiceIndex]);
  };

  const submitAnswer = () => {
    if (selectedAnswers.length === 0) return;
    const correct = isCorrectAnswer(selectedAnswers, question.correctAnswers);
    setAnswers((previous) => [
      ...previous.filter((answer) => answer.caseId !== currentCase.id),
      { caseId: currentCase.id, judgmentDimension: question.judgmentDimension, correct, rationale: "" },
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
    setRationale("");
    setPhase("overview");
  };

  const updateRationale = (value: string) => {
    setRationale(value);
    setAnswers((previous) => previous.map((answer) => answer.caseId === currentCase.id
      ? { ...answer, rationale: value }
      : answer));
  };

  const startNewRound = () => {
    setDeck(shuffleCaseStudies(getCaseStudies(difficulty)));
    setCaseIndex(0);
    setAnswers([]);
    setSelectedAnswers([]);
    setRationale("");
    setPhase("overview");
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
              correctCount={correctCount}
              deckSize={deck.length}
              onRestart={startNewRound}
              onClose={onClose}
            />
          ) : (
            <>
              <div className="case-study-case-heading">
                <span className="case-study-category">{currentCase.category}</span>
                <span className={`case-study-phase-label ${phase}`}>{phase === "overview" ? "案件概要" : phase === "question" ? "判断" : "振り返り"}</span>
                <h1>{currentCase.title}</h1>
                <p>{currentCase.background}</p>
              </div>

              {phase === "overview" && (
                <>
                  <CaseConditions scenario={currentCase} />
                  <div className="case-study-action-row">
                    <span>条件を確認したら、担当SEとして判断してください。</span>
                    <button className="case-study-primary" onClick={() => setPhase("question")}>設問へ進む <ArrowRight size={16} /></button>
                  </div>
                </>
              )}

              {phase === "question" && (
                <QuestionPanel
                  question={question}
                  selectedAnswers={selectedAnswers}
                  onToggle={toggleAnswer}
                  onSubmit={submitAnswer}
                />
              )}

              {phase === "review" && latestAnswer && (
                <CaseReview
                  question={question}
                  answer={latestAnswer}
                  selectedAnswers={selectedAnswers}
                  rationale={rationale}
                  onRationaleChange={updateRationale}
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
  selectedAnswers,
  onToggle,
  onSubmit,
}: {
  question: CaseQuestion;
  selectedAnswers: number[];
  onToggle: (choiceIndex: number) => void;
  onSubmit: () => void;
}) {
  const multiple = question.correctAnswers.length > 1;
  return (
    <section className="case-study-question-panel">
      <div className="case-study-question-title">
        <span>設問</span>
        <small>{multiple ? "複数選択" : "最も適切なものを1つ選択"}</small>
      </div>
      <h2>{question.question}</h2>
      <div className="case-study-choices">
        {question.choices.map((choice, index) => {
          const selected = selectedAnswers.includes(index);
          return (
            <button
              key={choice}
              className={`case-study-choice ${selected ? "selected" : ""}`}
              aria-pressed={selected}
              onClick={() => onToggle(index)}
            >
              <span className="case-study-choice-marker">{selected ? <Check size={15} /> : String.fromCharCode(65 + index)}</span>
              <span>{choice}</span>
            </button>
          );
        })}
      </div>
      <div className="case-study-action-row">
        <span>判断理由は回答後に任意で記録できます。</span>
        <button className="case-study-primary" disabled={selectedAnswers.length === 0} onClick={onSubmit}>
          判断を確認 <ArrowRight size={16} />
        </button>
      </div>
    </section>
  );
}

function CaseReview({
  question,
  answer,
  selectedAnswers,
  rationale,
  onRationaleChange,
  onNext,
  isLastCase,
}: {
  question: CaseQuestion;
  answer: CaseStudyAnswer;
  selectedAnswers: number[];
  rationale: string;
  onRationaleChange: (value: string) => void;
  onNext: () => void;
  isLastCase: boolean;
}) {
  const correctAnswerText = question.correctAnswers.map((index) => question.choices[index]).join(" / ");
  return (
    <section className="case-study-review">
      <div className={`case-study-verdict ${answer.correct ? "correct" : "incorrect"}`}>
        {answer.correct ? <CheckCircle2 size={21} /> : <AlertTriangle size={21} />}
        <div>
          <strong>{answer.correct ? "適切な判断です" : "この判断ではリスクが残ります"}</strong>
          <span>評価領域: {dimensionLabels[question.judgmentDimension]}</span>
        </div>
      </div>

      {answer.correct ? (
        <article className="case-study-consequence good">
          <strong>この判断の結果</strong>
          <p>{question.consequenceGood}</p>
        </article>
      ) : (
        <FailureSimulation question={question} />
      )}

      <article className="case-study-explanation">
        <div className="case-study-section-icon"><Lightbulb size={17} /></div>
        <div><h2>解説</h2><p>{question.explanation}</p></div>
      </article>

      <article className="case-study-senior-review">
        <div className="case-study-section-icon"><ShieldCheck size={17} /></div>
        <div>
          <h2>ベテランSEレビュー</h2>
          <p>{question.seniorReview}</p>
          <p className="case-study-selected-answer">
            <strong>あなたの判断:</strong> {selectedAnswers.map((index) => question.choices[index]).join(" / ")}
          </p>
          {!answer.correct && <p className="case-study-correct-answer"><strong>推奨判断:</strong> {correctAnswerText}</p>}
        </div>
      </article>

      <label className="case-study-rationale">
        <span>なぜその判断をしましたか？ <small>任意</small></span>
        <textarea
          value={rationale}
          onChange={(event) => onRationaleChange(event.target.value)}
          placeholder="例: 停止枠が短く、移行方式の実測と差分同期の確認が必要なため"
          rows={2}
        />
      </label>

      <div className="case-study-action-row">
        <span>この判断は「{dimensionLabels[question.judgmentDimension]}」として記録されます。</span>
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
      <div className="case-study-failure-heading"><AlertTriangle size={19} /><div><span>判断を誤った場合の障害シミュレーション</span><strong>{question.failureScenario.title}</strong></div></div>
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
  correctCount,
  deckSize,
  onRestart,
  onClose,
}: {
  difficulty: CaseStudyDifficulty;
  answers: CaseStudyAnswer[];
  score: ReturnType<typeof calculateCaseJudgmentScores>;
  correctCount: number;
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
        ? `${difficultyLabels[difficulty]}の案件をすべて確認しました。正誤だけでなく、判断領域ごとの傾向も振り返りましょう。`
        : "未回答の案件は次回の開始時に再度出題されます。今回の回答を確認しましょう。"}</p>

      <div className="case-study-total-score">
        <div><span>回答した案件</span><strong>{answers.length} / {deckSize}</strong></div>
        <div><span>適切な判断</span><strong>{correctCount} / {answers.length || 0}</strong></div>
        <div><span>総合正答率</span><strong>{answers.length ? `${Math.round((correctCount / answers.length) * 100)}%` : "—"}</strong></div>
      </div>

      <section className="case-study-dimension-scores">
        <h2>判断領域別スコア</h2>
        <div>
          {caseJudgmentDimensions.map(({ id, title }) => {
            const item = score[id];
            return (
              <article key={id}>
                <div><strong>{title}</strong><span>{item.percentage === null ? "未回答" : `${item.percentage}% · ${item.correct}/${item.total}`}</span></div>
                <div className="case-study-score-track"><span style={{ width: `${item.percentage ?? 0}%` }} /></div>
              </article>
            );
          })}
        </div>
      </section>

      <p className="case-study-score-note">スコアは選択した判断の正誤を領域ごとに集計します。理由メモはこの演習中の振り返りに使います。</p>
      <div className="case-study-action-row">
        <button className="case-study-secondary" onClick={onClose}><ArrowLeft size={15} /> デスクトップへ戻る</button>
        <button className="case-study-primary" onClick={onRestart}><RotateCcw size={15} /> 同じ難易度でもう一周</button>
      </div>
    </section>
  );
}
