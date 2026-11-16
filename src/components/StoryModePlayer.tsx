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
import type { StoryModeDefinition, TutorialStep } from "../domain/models";

type FocusRect = { top: number; left: number; width: number; height: number };

export function StoryModePlayer({
  story,
  tutorialSteps,
  focusTargetId,
  onStepChange,
  onExit,
  onStartTutorial,
}: {
  story: StoryModeDefinition;
  tutorialSteps: TutorialStep[];
  focusTargetId: string;
  onStepChange: (step: TutorialStep) => void;
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
  const [focusRect, setFocusRect] = useState<FocusRect | null>(null);
  const startedAt = useRef(Date.now());
  const onStepChangeRef = useRef(onStepChange);
  onStepChangeRef.current = onStepChange;
  const step = tutorialSteps[stepIndex];

  if (!step) throw new Error("観察モードのチュートリアル手順がありません。");

  const enhancement = story.steps.find((item) => item.tutorialStepId === step.id);
  const actions = enhancement?.autoActions ?? [];
  const quiz = enhancement?.quiz;
  const recommendedChoice = quiz?.choices.find((choice) => choice.correct);
  const playbackComplete = visibleActionCount >= actions.length;
  const cardSide = focusRect && focusRect.left + focusRect.width / 2 < window.innerWidth / 2 ? "side-right" : "side-left";

  useEffect(() => {
    onStepChangeRef.current(step);
  }, [step.id]);

  useEffect(() => {
    const target = document.querySelector<HTMLElement>(`[data-observation-target="${focusTargetId}"]`);
    if (!target) {
      setFocusRect(null);
      return;
    }

    const measure = () => {
      const rect = target.getBoundingClientRect();
      const padding = 7;
      const left = Math.max(4, rect.left - padding);
      const top = Math.max(4, rect.top - padding);
      setFocusRect({
        left,
        top,
        width: Math.min(window.innerWidth - left - 4, rect.width + padding * 2),
        height: Math.min(window.innerHeight - top - 4, rect.height + padding * 2),
      });
    };

    target.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
    const frame = window.requestAnimationFrame(measure);
    const settleTimer = window.setTimeout(measure, 220);
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(settleTimer);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [focusTargetId, step.id]);

  useEffect(() => {
    setVisibleActionCount(0);
    if (actions.length === 0) return;
    let visibleCount = 0;
    const timer = window.setInterval(() => {
      visibleCount += 1;
      setVisibleActionCount(visibleCount);
      if (visibleCount >= actions.length) window.clearInterval(timer);
    }, 550);
    return () => window.clearInterval(timer);
  }, [step.id, actions.length]);

  useEffect(() => {
    if (
      !autoPlay
      || completedAt !== null
      || failureVisible
      || !playbackComplete
      || (quiz && !quizOutcome)
    ) return;

    const timer = window.setTimeout(() => {
      if (stepIndex === tutorialSteps.length - 1) {
        setCompletedAt(Date.now());
      } else {
        setStepIndex((current) => current + 1);
        setQuizOutcome(null);
        setQuizFeedback("");
      }
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [autoPlay, completedAt, failureVisible, playbackComplete, quiz, quizOutcome, stepIndex, tutorialSteps.length]);

  const handleChoice = (choiceId: string) => {
    const choice = quiz?.choices.find((item) => item.id === choiceId);
    if (!quiz || !choice || !playbackComplete) return;
    if (choice.correct) {
      setQuizOutcome("correct");
      setQuizFeedback(quiz.answerExplanation);
    } else if (enhancement?.failureBranch) {
      setFailureOccurred(true);
      setFailureVisible(true);
    } else {
      setQuizFeedback("推奨回答ではありません。選択肢を見直して、もう一度考えてみましょう。");
    }
  };

  const skipQuiz = () => {
    if (!quiz || !recommendedChoice || !playbackComplete) return;
    setQuizOutcome("skipped");
    setQuizFeedback(`今回はスキップしました。推奨回答: ${recommendedChoice.label}。${quiz.answerExplanation}`);
  };

  const advance = () => {
    if (!playbackComplete || (quiz && !quizOutcome)) return;
    if (stepIndex === tutorialSteps.length - 1) {
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

  const closeToDesktop = () => {
    setFocusRect(null);
    onExit();
  };

  let overlayContent;
  if (failureVisible && enhancement?.failureBranch) {
    const failure = enhancement.failureBranch;
    overlayContent = (
      <section className={`observation-card ${cardSide} observation-failure`} aria-live="polite">
        <span className="observation-eyebrow">判断の結果を見てみましょう</span>
        <h1>{failure.title}</h1>
        <p className="observation-failure-impact">{failure.impact}</p>
        <ol className="observation-failure-diagram">
          {failure.diagram.map((node, index) => (
            <li key={`${node}-${index}`}>
              <span>{node}</span>
              {index < failure.diagram.length - 1 && <b aria-hidden="true">↓</b>}
            </li>
          ))}
        </ol>
        <div className="observation-failure-cause">
          <strong>原因</strong>
          <p>{failure.cause}</p>
        </div>
        <button
          className="observation-primary-button"
          onClick={() => {
            setFailureVisible(false);
            setQuizOutcome(null);
            setQuizFeedback(failure.recovery);
          }}
        >
          理解した・判断地点へ戻る
        </button>
      </section>
    );
  } else if (completedAt !== null) {
    const elapsedMinutes = Math.max(1, Math.ceil((completedAt - startedAt.current) / 60_000));
    overlayContent = (
      <section className={`observation-card ${cardSide} observation-complete`}>
        <div className="observation-complete-icon"><CheckCircle2 size={26} /></div>
        <span className="observation-eyebrow">チュートリアルの流れを見終えました</span>
        <h1>今回学んだ内容</h1>
        <ul className="observation-learning-list">
          {tutorialSteps.map((item, index) => (
            <li key={item.id}><CheckCircle2 size={15} />手順 {index + 1}: {summaryLabel(item.instruction)}</li>
          ))}
        </ul>
        <div className="observation-complete-summary">
          <span>所要時間 <strong>約{elapsedMinutes}分</strong></span>
          <span>失敗シナリオ <strong>{failureOccurred ? "体験しました" : "未体験"}</strong></span>
        </div>
        <div className="observation-actions">
          <button className="observation-quiet-button" onClick={restart}><RotateCcw size={15} />もう一度見る</button>
          <button className="observation-primary-button" onClick={onStartTutorial}><Play size={15} />チュートリアルを始める</button>
        </div>
      </section>
    );
  } else {
    overlayContent = (
      <section className={`observation-card ${cardSide}`} aria-live="polite">
        <div className="observation-step-heading">
          <span className="observation-eyebrow">チュートリアルを観察 · 手順 {stepIndex + 1} / {tutorialSteps.length}</span>
          <div className="observation-progress"><span style={{ width: `${((stepIndex + 1) / tutorialSteps.length) * 100}%` }} /></div>
        </div>
        <div className="observation-instruction">
          <strong>画面で行われていること</strong>
          <p>{step.instruction}</p>
        </div>
        <div className="observation-explanation">
          <strong>なぜ必要？</strong>
          <p>{step.explanation}</p>
        </div>
        {enhancement && (
          <div className="observation-ai-comment">
            <Lightbulb size={16} />
            <div><strong>AI上司コメント</strong><p>{enhancement.aiComment}</p></div>
          </div>
        )}
        {actions.length > 0 && (
          <section className="observation-action-playback" aria-label="操作の再生">
            <strong><span aria-hidden="true">&gt;_</span> 操作の再生</strong>
            {actions.slice(0, visibleActionCount).map((action, index) => (
              <article key={`${step.id}-${index}`}>
                <div><small>{action.actor}</small><b>{action.label}</b></div>
                {action.command && <code>{action.command}</code>}
                <pre>{action.output.join("\n")}</pre>
              </article>
            ))}
            {!playbackComplete && <span className="observation-playing">操作を再生しています...</span>}
          </section>
        )}
        {quiz && (
          <section className="observation-quiz">
            <span className="observation-eyebrow">理解チェック · 回答は任意</span>
            <h2>{quiz.question}</h2>
            <div className="observation-quiz-choices">
              {quiz.choices.map((choice) => (
                <button key={choice.id} disabled={!playbackComplete || quizOutcome !== null} onClick={() => handleChoice(choice.id)}>
                  {choice.label}
                </button>
              ))}
            </div>
            {quizFeedback && <p className="observation-quiz-feedback" role="status">{quizFeedback}</p>}
            {quizOutcome === null && (
              <button className="observation-skip-button" disabled={!playbackComplete} onClick={skipQuiz}>
                <SkipForward size={14} />スキップして推奨回答を見る
              </button>
            )}
          </section>
        )}
        <div className="observation-footer">
          <span>{quizOutcome === "correct" ? "判断できました" : quizOutcome === "skipped" ? "推奨回答を確認しました" : "ハイライトされた画面を確認してください"}</span>
          <button className="observation-primary-button" disabled={!playbackComplete || (quiz !== undefined && quizOutcome === null)} onClick={advance}>
            {stepIndex === tutorialSteps.length - 1 ? "学習内容を振り返る" : "次へ"}
            <ArrowRight size={15} />
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className={`observation-overlay ${focusRect ? "has-focus" : "no-focus"}`} role="dialog" aria-modal="true" aria-label="観察モード">
      <div className="observation-blocker" aria-hidden="true" />
      <div className="observation-dim" aria-hidden="true" />
      {focusRect && completedAt === null && !failureVisible && (
        <div
          className="observation-focus-frame"
          aria-hidden="true"
          style={{
            top: focusRect.top,
            left: focusRect.left,
            width: focusRect.width,
            height: focusRect.height,
          }}
        />
      )}
      <header className="observation-toolbar">
        <span><BookOpen size={17} />PROJECT<span>LAB</span> <b>観察モード</b></span>
        <label><input type="checkbox" checked={autoPlay} onChange={(event) => setAutoPlay(event.target.checked)} />自動再生</label>
        <button className="observation-quiet-button" onClick={closeToDesktop}><ArrowLeft size={15} />デスクトップへ戻る</button>
      </header>
      {overlayContent}
    </div>
  );
}

function summaryLabel(instruction: string): string {
  const firstSentence = instruction.split("。")[0] ?? instruction;
  return firstSentence.length > 54 ? `${firstSentence.slice(0, 54)}...` : firstSentence;
}
