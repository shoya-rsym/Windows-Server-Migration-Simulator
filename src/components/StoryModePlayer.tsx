import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Lightbulb,
  Play,
  RotateCcw,
  SkipForward,
} from "lucide-react";
import type { StoryModeDefinition } from "../domain/models";

export function StoryModePlayer({
  story,
  onExit,
  onStartTutorial,
}: {
  story: StoryModeDefinition;
  onExit: () => void;
  onStartTutorial: () => void;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [visibleActionCount, setVisibleActionCount] = useState(0);
  const [quizOutcome, setQuizOutcome] = useState<"correct" | "skipped" | null>(null);
  const [quizFeedback, setQuizFeedback] = useState("");
  const [failureVisible, setFailureVisible] = useState(false);
  const [failureOccurred, setFailureOccurred] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  const [completedAt, setCompletedAt] = useState<number | null>(null);
  const startedAt = useRef(Date.now());
  const step = story.steps[stepIndex];

  if (!step) throw new Error("観察モードの手順がありません。");

  const playbackComplete = visibleActionCount >= step.autoActions.length;
  const recommendedChoice = step.quiz?.choices.find((choice) => choice.correct);

  useEffect(() => {
    setVisibleActionCount(0);
    let visibleCount = 0;
    const timer = window.setInterval(() => {
      visibleCount += 1;
      setVisibleActionCount(visibleCount);
      if (visibleCount >= step.autoActions.length) window.clearInterval(timer);
    }, 550);
    return () => window.clearInterval(timer);
  }, [step.id, step.autoActions.length]);

  useEffect(() => {
    if (
      !autoPlay
      || completedAt !== null
      || failureVisible
      || !playbackComplete
      || (step.quiz && !quizOutcome)
    ) return;

    const timer = window.setTimeout(() => {
      if (stepIndex === story.steps.length - 1) {
        setCompletedAt(Date.now());
      } else {
        setStepIndex((current) => current + 1);
        setQuizOutcome(null);
        setQuizFeedback("");
      }
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [autoPlay, completedAt, failureVisible, playbackComplete, quizOutcome, step.quiz, stepIndex, story.steps.length]);

  const handleChoice = (choiceId: string) => {
    const choice = step.quiz?.choices.find((item) => item.id === choiceId);
    if (!choice || !playbackComplete) return;
    if (choice.correct) {
      setQuizOutcome("correct");
      setQuizFeedback(step.quiz?.answerExplanation ?? "");
    } else if (step.failureBranch) {
      setFailureOccurred(true);
      setFailureVisible(true);
    } else {
      setQuizFeedback("推奨回答ではありません。選択肢を見直して、もう一度考えてみましょう。");
    }
  };

  const skipQuiz = () => {
    if (!step.quiz || !recommendedChoice || !playbackComplete) return;
    setQuizOutcome("skipped");
    setQuizFeedback(`今回はスキップしました。推奨回答: ${recommendedChoice.label}。${step.quiz.answerExplanation}`);
  };

  const advance = () => {
    if (!playbackComplete || (step.quiz && !quizOutcome)) return;
    if (stepIndex === story.steps.length - 1) {
      setCompletedAt(Date.now());
      return;
    }
    setStepIndex((current) => current + 1);
    setQuizOutcome(null);
    setQuizFeedback("");
  };

  const restart = () => {
    startedAt.current = Date.now();
    setStepIndex(0);
    setVisibleActionCount(0);
    setQuizOutcome(null);
    setQuizFeedback("");
    setFailureVisible(false);
    setFailureOccurred(false);
    setCompletedAt(null);
  };

  if (failureVisible && step.failureBranch) {
    const failure = step.failureBranch;
    return (
      <main className="story-screen story-failure-screen">
        <header className="story-header">
          <button className="story-quiet-button" onClick={onExit}><ArrowLeft size={17} />デスクトップへ戻る</button>
          <strong><BookOpen size={18} />観察モード / 失敗シナリオ</strong>
          <span />
        </header>
        <section className="story-failure-card" aria-live="polite">
          <span className="story-eyebrow">判断の結果を見てみましょう</span>
          <h1>{failure.title}</h1>
          <p className="story-failure-impact">{failure.impact}</p>
          <ol className="story-failure-diagram">
            {failure.diagram.map((node, index) => (
              <li key={`${node}-${index}`}>
                <span>{node}</span>
                {index < failure.diagram.length - 1 && <b aria-hidden="true">↓</b>}
              </li>
            ))}
          </ol>
          <div className="story-failure-cause">
            <strong>原因</strong>
            <p>{failure.cause}</p>
          </div>
          <button
            className="story-primary-button"
            onClick={() => {
              setFailureVisible(false);
              setQuizOutcome(null);
              setQuizFeedback(failure.recovery);
            }}
          >
            理解した・判断地点へ戻る
          </button>
        </section>
      </main>
    );
  }

  if (completedAt !== null) {
    const elapsedMinutes = Math.max(1, Math.ceil((completedAt - startedAt.current) / 60_000));
    return (
      <main className="story-screen story-complete-screen">
        <header className="story-header">
          <button className="story-quiet-button" onClick={onExit}><ArrowLeft size={17} />デスクトップへ戻る</button>
          <strong><BookOpen size={18} />観察モード / 学習完了</strong>
          <span />
        </header>
        <section className="story-complete-card">
          <div className="story-complete-icon"><CheckCircle2 size={30} /></div>
          <span className="story-eyebrow">案件の流れを見終えました</span>
          <h1>今回学んだ内容</h1>
          <ul className="story-learning-list">
            {story.steps.map((item) => <li key={item.id}><CheckCircle2 size={16} />{item.title}</li>)}
          </ul>
          <div className="story-complete-summary">
            <span>所要時間 <strong>約{elapsedMinutes}分</strong></span>
            <span>失敗シナリオ <strong>{failureOccurred ? "体験しました" : "未体験"}</strong></span>
          </div>
          <div className="story-complete-actions">
            <button className="story-quiet-button" onClick={restart}><RotateCcw size={16} />もう一度見る</button>
            <button className="story-primary-button" onClick={onStartTutorial}><Play size={16} />チュートリアルへ進む</button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="story-screen">
      <header className="story-header">
        <button className="story-quiet-button" onClick={onExit}><ArrowLeft size={17} />デスクトップへ戻る</button>
        <strong><BookOpen size={18} />観察モード</strong>
        <label className="story-autoplay-toggle">
          <input type="checkbox" checked={autoPlay} onChange={(event) => setAutoPlay(event.target.checked)} />
          <span>自動再生</span>
        </label>
      </header>

      <div className="story-layout">
        <aside className="story-sidebar">
          <span className="story-eyebrow">今回の案件</span>
          <h2>移行プロジェクトの流れ</h2>
          <ol className="story-step-list">
            {story.steps.map((item, index) => (
              <li className={index === stepIndex ? "active" : index < stepIndex ? "complete" : ""} key={item.id}>
                <span className="story-step-number">{index < stepIndex ? <CheckCircle2 size={15} /> : index + 1}</span>
                <span>{item.title}</span>
              </li>
            ))}
          </ol>
        </aside>

        <section className="story-main" aria-live="polite">
          <div className="story-progress-label"><span>STEP {stepIndex + 1} / {story.steps.length}</span><span>{Math.round(((stepIndex + 1) / story.steps.length) * 100)}%</span></div>
          <div className="story-progress-track"><span style={{ width: `${((stepIndex + 1) / story.steps.length) * 100}%` }} /></div>

          <div className="story-target-card">
            <span>注目している対象</span>
            <strong>{step.targetElement}</strong>
          </div>
          <h1>{step.title}</h1>

          <section className="story-action-log" aria-label="操作の再生">
            <div className="story-section-heading"><TerminalIcon /> <strong>案件で行われた操作</strong></div>
            {step.autoActions.slice(0, visibleActionCount).map((action, index) => (
              <article className="story-action-entry" key={`${step.id}-${index}`}>
                <div className="story-action-heading"><span>{action.actor}</span><strong>{action.label}</strong></div>
                {action.command && <code>{action.command}</code>}
                <pre>{action.output.join("\n")}</pre>
              </article>
            ))}
            {!playbackComplete && <p className="story-playback-status"><span />操作を再生しています...</p>}
          </section>

          <div className="story-explanation">
            <strong>なぜ必要？</strong>
            <p>{step.explanation}</p>
          </div>
          <div className="story-ai-comment"><Lightbulb size={17} /><div><strong>AI上司コメント</strong><p>{step.aiComment}</p></div></div>

          {step.quiz && (
            <section className="story-quiz">
              <span className="story-eyebrow">理解チェック / 回答は任意</span>
              <h2>{step.quiz.question}</h2>
              {!playbackComplete && <p className="story-quiz-wait">操作の再生が終わると回答できます。</p>}
              <div className="story-quiz-choices">
                {step.quiz.choices.map((choice) => (
                  <button
                    key={choice.id}
                    disabled={!playbackComplete || quizOutcome !== null}
                    onClick={() => handleChoice(choice.id)}
                  >
                    {choice.label}
                  </button>
                ))}
              </div>
              {quizFeedback && <p className="story-quiz-feedback" role="status">{quizFeedback}</p>}
              {quizOutcome === null && (
                <button className="story-skip-button" disabled={!playbackComplete} onClick={skipQuiz}>
                  <SkipForward size={15} />スキップして推奨回答を見る
                </button>
              )}
            </section>
          )}

          <div className="story-navigation">
            <span>{quizOutcome === "correct" ? "判断できました" : quizOutcome === "skipped" ? "推奨回答を確認しました" : "操作と解説を確認してください"}</span>
            <button className="story-primary-button" disabled={!playbackComplete || (step.quiz !== undefined && quizOutcome === null)} onClick={advance}>
              {stepIndex === story.steps.length - 1 ? "学習内容を振り返る" : "次へ"}
              <ArrowRight size={16} />
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

function TerminalIcon() {
  return <span className="story-terminal-icon" aria-hidden="true">&gt;_</span>;
}
