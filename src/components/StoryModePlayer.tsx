import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
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
import type { ProjectDependency, StoryModeDefinition, StoryPhase, TutorialStep } from "../domain/models";

type FocusRect = { top: number; left: number; width: number; height: number };
type QuizProgress = {
  selectedChoiceId: string | null;
  outcome: "correct" | "skipped" | null;
  feedback: string;
  wrongAttemptCount: number;
};

const EMPTY_QUIZ_PROGRESS: QuizProgress = {
  selectedChoiceId: null,
  outcome: null,
  feedback: "",
  wrongAttemptCount: 0,
};

export function StoryModePlayer({
  story,
  tutorialSteps,
  projectDependencies,
  focusTargetId,
  onStepChange,
  onExit,
  onStartTutorial,
}: {
  story: StoryModeDefinition;
  tutorialSteps: TutorialStep[];
  projectDependencies: ProjectDependency[];
  focusTargetId: string;
  onStepChange: (step: TutorialStep) => void;
  onExit: () => void;
  onStartTutorial: () => void;
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [visibleActionCount, setVisibleActionCount] = useState(0);
  const [quizProgressByStep, setQuizProgressByStep] = useState<Record<string, QuizProgress>>({});
  const [stepNumberInput, setStepNumberInput] = useState("1");
  const [failureVisible, setFailureVisible] = useState(false);
  const [failureOccurred, setFailureOccurred] = useState(false);
  const [autoPlay, setAutoPlay] = useState(false);
  const [completedAt, setCompletedAt] = useState<number | null>(null);
  const [focusRect, setFocusRect] = useState<FocusRect | null>(null);
  const [cardPosition, setCardPosition] = useState<CSSProperties | null>(null);
  const cardRef = useRef<HTMLElement | null>(null);
  const startedAt = useRef(Date.now());
  const onStepChangeRef = useRef(onStepChange);
  onStepChangeRef.current = onStepChange;
  const step = tutorialSteps[stepIndex];

  if (!step) throw new Error("観察モードのチュートリアル手順がありません。");

  const phases: StoryPhase[] = story.phases ?? [{
    id: "project",
    title: "案件進行",
    startStep: 1,
    endStep: tutorialSteps.length,
  }];
  const reviewFlow = story.review?.flow ?? phases.map((phase) => ({
    title: phase.title,
    items: tutorialSteps.slice(phase.startStep - 1, phase.endStep).map((item) => summaryLabel(item.instruction)),
  }));
  const learningOutcomes = story.review?.learningOutcomes ?? tutorialSteps.map((item) => summaryLabel(item.instruction));
  const quizProgress = quizProgressByStep[step.id] ?? EMPTY_QUIZ_PROGRESS;
  const enhancement = story.steps.find((item) => item.tutorialStepId === step.id);
  const actions = enhancement?.autoActions ?? [];
  const quiz = enhancement?.quiz;
  const recommendedChoice = quiz?.choices.find((choice) => choice.correct);
  const playbackComplete = visibleActionCount >= actions.length;
  const cardPositionStyle = completedAt === null ? cardPosition ?? undefined : undefined;
  const quizSteps = story.steps.filter((item) => item.quiz);
  const answeredQuizCount = quizSteps.filter((item) => quizProgressByStep[item.tutorialStepId]?.outcome === "correct").length;
  const skippedQuizCount = quizSteps.filter((item) => quizProgressByStep[item.tutorialStepId]?.outcome === "skipped").length;
  const unansweredQuizCount = quizSteps.length - answeredQuizCount - skippedQuizCount;
  const firstTryCorrectCount = quizSteps.filter((item) => {
    const progress = quizProgressByStep[item.tutorialStepId];
    return progress?.outcome === "correct" && progress.wrongAttemptCount === 0;
  }).length;
  const firstTryAccuracy = answeredQuizCount > 0
    ? Math.round((firstTryCorrectCount / answeredQuizCount) * 100)
    : null;
  const wrongAttemptCount = quizSteps.reduce(
    (total, item) => total + (quizProgressByStep[item.tutorialStepId]?.wrongAttemptCount ?? 0),
    0,
  );
  const currentStepNumber = stepIndex + 1;
  const phaseBar = (allComplete = false) => (
    <nav className="observation-phase-bar" aria-label="案件全体の工程">
      {phases.map((phase, index) => {
        const complete = allComplete || currentStepNumber > phase.endStep;
        const active = !allComplete && currentStepNumber >= phase.startStep && currentStepNumber <= phase.endStep;
        const stepCount = phase.endStep - phase.startStep + 1;
        const progress = complete
          ? 100
          : active
            ? Math.round(((currentStepNumber - phase.startStep + 1) / stepCount) * 100)
            : 0;
        return (
          <div className={`observation-phase ${complete ? "complete" : ""} ${active ? "active" : ""}`} key={phase.id} aria-current={active ? "step" : undefined}>
            <span><small>{index + 1}</small>{phase.title}</span>
            <div
              className="observation-phase-progress"
              role="progressbar"
              aria-label={`${phase.title}の進捗`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
            ><i style={{ width: `${progress}%` }} /></div>
          </div>
        );
      })}
    </nav>
  );

  useEffect(() => {
    onStepChangeRef.current(step);
  }, [step.id]);

  useEffect(() => {
    let target: HTMLElement | null = null;
    let preferredTargetFound = false;
    let measureFrame = 0;
    let settleTimer = 0;
    const measure = () => {
      if (!target) {
        setFocusRect(null);
        return;
      }
      const rect = target.getBoundingClientRect();
      const padding = 7;
      const left = Math.max(4, Math.min(window.innerWidth - 8, rect.left - padding));
      const top = Math.max(4, Math.min(window.innerHeight - 8, rect.top - padding));
      const nextRect = {
        left,
        top,
        width: Math.min(window.innerWidth - left - 4, rect.width + padding * 2),
        height: Math.min(window.innerHeight - top - 4, rect.height + padding * 2),
      };
      setFocusRect((current) => current
        && current.left === nextRect.left
        && current.top === nextRect.top
        && current.width === nextRect.width
        && current.height === nextRect.height
        ? current
        : nextRect);
    };

    const revealTarget = () => {
      const compactViewport = window.innerWidth <= 800;
      target?.scrollIntoView({ block: compactViewport ? "start" : "center", inline: "nearest", behavior: compactViewport ? "auto" : "smooth" });
      window.cancelAnimationFrame(measureFrame);
      window.clearTimeout(settleTimer);
      measureFrame = window.requestAnimationFrame(() => {
        if (compactViewport && target) {
          const topOffset = target.getBoundingClientRect().top - 56;
          if (Math.abs(topOffset) > 4) window.scrollBy({ top: topOffset, behavior: "auto" });
        }
        measure();
      });
      settleTimer = window.setTimeout(measure, 220);
    };
    const findTarget = () => {
      const preferredTarget = document.querySelector<HTMLElement>(`[data-observation-target="${focusTargetId}"]`);
      if (preferredTarget) {
        if (preferredTarget !== target || !preferredTargetFound) {
          target = preferredTarget;
          preferredTargetFound = true;
          observer.disconnect();
          revealTarget();
        } else {
          measure();
        }
        return;
      }

      preferredTargetFound = false;
      const fallbackTarget = document.querySelector<HTMLElement>('[data-observation-target="server-grid"]');
      if (fallbackTarget && fallbackTarget !== target) {
        target = fallbackTarget;
        measure();
      } else if (target) {
        measure();
      } else {
        setFocusRect(null);
      }
    };
    const observer = new MutationObserver(findTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    findTarget();
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(measureFrame);
      window.clearTimeout(settleTimer);
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [focusTargetId, step.id]);

  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card || !focusRect || completedAt !== null) {
      setCardPosition(null);
      return;
    }

    const viewportWidth = document.documentElement.clientWidth || window.innerWidth;
    const viewportHeight = window.innerHeight;
    const rightSpace = viewportWidth - focusRect.left - focusRect.width - 16;
    const leftSpace = focusRect.left - 16;
    const sideSpace = Math.max(rightSpace, leftSpace);
    const sideWidth = Math.min(760, sideSpace - 24);
    const useSidePosition = viewportWidth > 900 && sideWidth >= 420;
    const below = focusRect.top + focusRect.height + 12;
    const belowSpace = viewportHeight - below - 16;
    const useBelowPosition = viewportWidth <= 800 && belowSpace >= 180;
    const width = useSidePosition ? sideWidth : Math.max(240, Math.min(760, viewportWidth - 32));
    const maxHeight = useBelowPosition
      ? belowSpace
      : viewportWidth <= 800
        ? Math.min(viewportHeight - 80, Math.max(240, viewportHeight * 0.5))
        : Math.max(180, viewportHeight - 80);

    card.style.width = `${width}px`;
    card.style.maxHeight = `${maxHeight}px`;
    const height = card.getBoundingClientRect().height;
    const left = useSidePosition
      ? (rightSpace >= leftSpace ? focusRect.left + focusRect.width + 12 : focusRect.left - width - 12)
      : (viewportWidth - width) / 2;
    let top: number;
    if (useSidePosition) {
      top = Math.max(56, Math.min(focusRect.top, viewportHeight - height - 16));
    } else if (useBelowPosition) {
      top = below;
    } else {
      const above = focusRect.top - height - 12;
      if (below + height <= viewportHeight - 16) top = below;
      else if (above >= 56) top = above;
      else top = Math.max(56, Math.min(focusRect.top, viewportHeight - height - 16));
    }

    setCardPosition({
      left: Math.max(16, Math.min(left, viewportWidth - width - 16)),
      top,
      width,
      maxHeight,
      right: "auto",
      bottom: "auto",
      transform: "none",
    });
  }, [
    completedAt,
    failureVisible,
    focusRect,
    playbackComplete,
    quizProgress.feedback,
    quizProgress.outcome,
    quizProgress.selectedChoiceId,
    step.id,
    visibleActionCount,
  ]);

  useEffect(() => {
    setStepNumberInput(String(stepIndex + 1));
  }, [stepIndex]);

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
      || (quiz && !quizProgress.outcome)
    ) return;

    const timer = window.setTimeout(() => {
      if (stepIndex === tutorialSteps.length - 1) {
        setCompletedAt(Date.now());
      } else {
        setStepIndex((current) => current + 1);
      }
    }, 2500);
    return () => window.clearTimeout(timer);
  }, [autoPlay, completedAt, failureVisible, playbackComplete, quiz, quizProgress.outcome, stepIndex, tutorialSteps.length]);

  const updateQuizProgress = (updates: Partial<QuizProgress>) => {
    setQuizProgressByStep((current) => ({
      ...current,
      [step.id]: { ...(current[step.id] ?? EMPTY_QUIZ_PROGRESS), ...updates },
    }));
  };

  const goToStep = (index: number) => {
    setAutoPlay(false);
    setFailureVisible(false);
    setCompletedAt(null);
    setStepIndex(index);
  };

  const handleChoice = (choiceId: string) => {
    const choice = quiz?.choices.find((item) => item.id === choiceId);
    if (!quiz || !choice || !playbackComplete || quizProgress.outcome !== null) return;
    if (choice.correct) {
      updateQuizProgress({
        selectedChoiceId: choiceId,
        outcome: "correct",
        feedback: quiz.answerExplanation,
      });
    } else if (enhancement?.failureBranch) {
      updateQuizProgress({
        selectedChoiceId: choiceId,
        feedback: "",
        wrongAttemptCount: quizProgress.wrongAttemptCount + 1,
      });
      setFailureOccurred(true);
      setFailureVisible(true);
    } else {
      updateQuizProgress({
        selectedChoiceId: choiceId,
        wrongAttemptCount: quizProgress.wrongAttemptCount + 1,
        feedback: choice.feedback ?? "推奨回答ではありません。選択肢を見直して、もう一度考えてみましょう。",
      });
    }
  };

  const skipQuiz = () => {
    if (!quiz || !recommendedChoice || !playbackComplete || quizProgress.outcome !== null) return;
    updateQuizProgress({
      outcome: "skipped",
      feedback: `今回はスキップしました。推奨回答: ${recommendedChoice.label}。${quiz.answerExplanation}`,
    });
  };

  const advance = () => {
    if (!playbackComplete || (quiz && !quizProgress.outcome)) return;
    if (stepIndex === tutorialSteps.length - 1) {
      setCompletedAt(Date.now());
      return;
    }
    setStepIndex((current) => current + 1);
  };

  const jumpToStep = () => {
    const requestedStep = Number(stepNumberInput);
    if (!Number.isInteger(requestedStep) || requestedStep < 1 || requestedStep > tutorialSteps.length) return;
    goToStep(requestedStep - 1);
  };

  const restart = () => {
    startedAt.current = Date.now();
    setStepIndex(0);
    setVisibleActionCount(0);
    setQuizProgressByStep({});
    setStepNumberInput("1");
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
      <section ref={cardRef} className="observation-card observation-failure" style={cardPositionStyle} aria-live="polite">
        {phaseBar()}
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
            updateQuizProgress({ feedback: failure.recovery });
          }}
        >
          理解した・判断地点へ戻る
        </button>
      </section>
    );
  } else if (completedAt !== null) {
    const elapsedMinutes = Math.max(1, Math.ceil((completedAt - startedAt.current) / 60_000));
    overlayContent = (
      <section className="observation-card observation-complete" aria-label="案件レビュー">
        {phaseBar(true)}
        <header className="observation-review-header">
          <div className="observation-complete-icon"><CheckCircle2 size={24} /></div>
          <div>
            <span className="observation-eyebrow">観察モード · 案件レビュー</span>
            <h1>案件全体を振り返る</h1>
          </div>
        </header>
        <div className="observation-review-metrics">
          <article><span>所要時間</span><strong>約{elapsedMinutes}分</strong></article>
          <article>
            <span>クイズ回答</span>
            <strong>{answeredQuizCount} / {quizSteps.length}問</strong>
            <small>スキップ {skippedQuizCount} · 未回答 {unansweredQuizCount}</small>
          </article>
          <article>
            <span>初回正答率</span>
            <strong>{firstTryAccuracy === null ? "—" : `${firstTryAccuracy}%`}</strong>
            <small>{firstTryCorrectCount} / {answeredQuizCount}問</small>
          </article>
          <article>
            <span>誤答・再考</span>
            <strong>{wrongAttemptCount}回</strong>
            <small>初回の選択から集計</small>
          </article>
          <article>
            <span>失敗シナリオ</span>
            <strong>{failureOccurred ? "体験済み" : "未体験"}</strong>
          </article>
        </div>
        <section className="observation-review-flow" aria-label="案件全体の流れ">
          <h2>案件全体の流れ</h2>
          <ol>
            {reviewFlow.map((section, index) => (
              <li key={`${section.title}-${index}`}>
                <span className="observation-review-number">{index + 1}</span>
                <div>
                  <h3>{section.title}</h3>
                  <ul>{section.items.map((item) => <li key={item}>{item}</li>)}</ul>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <div className="observation-review-details">
          <section aria-label="今回学んだ内容">
            <h2>今回学んだ内容</h2>
            <ul className="observation-learning-list">
              {learningOutcomes.map((item) => (
                <li key={item}><CheckCircle2 size={14} />{item}</li>
              ))}
            </ul>
          </section>
          <section className="observation-system-map" aria-label="システム全体図">
            <h2>システム全体図</h2>
            {projectDependencies.length > 0
              ? <ul>{projectDependencies.map((dependency) => (
                <li key={dependency.id}>
                  <strong>{dependency.from}</strong>
                  <ArrowRight size={13} aria-hidden="true" />
                  <strong>{dependency.to}</strong>
                  <small>{dependency.reason}</small>
                </li>
              ))}</ul>
              : <p>このシナリオには接続関係が定義されていません。</p>}
          </section>
        </div>
        <div className="observation-actions">
          <button className="observation-quiet-button" onClick={() => goToStep(0)}><ArrowLeft size={15} />手順を見返す</button>
          <button className="observation-quiet-button" onClick={restart}><RotateCcw size={15} />もう一度見る</button>
          <button className="observation-primary-button" onClick={onStartTutorial}><Play size={15} />チュートリアルを始める</button>
          <button className="observation-quiet-button" onClick={closeToDesktop}><ArrowLeft size={15} />デスクトップへ戻る</button>
        </div>
      </section>
    );
  } else {
    overlayContent = (
      <section ref={cardRef} className="observation-card" style={cardPositionStyle} aria-live="polite">
        {phaseBar()}
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
        {enhancement?.failureExample && (
          <aside className="observation-failure-example" aria-label="この作業を飛ばした場合の影響">
            <strong><span aria-hidden="true">⚠</span> この作業を飛ばすと？</strong>
            <h2>{enhancement.failureExample.title}</h2>
            <p>{enhancement.failureExample.description}</p>
            <p><b>想定される影響:</b> {enhancement.failureExample.impact}</p>
          </aside>
        )}
        {enhancement && (
          <div className="observation-ai-comment">
            <Lightbulb size={16} />
            <div><strong>AI上司コメント</strong><p>{enhancement.aiComment}</p></div>
          </div>
        )}
        {actions.length > 0 && !(focusTargetId.startsWith("console-") && actions.every((action) => action.command)) && (
          <section className="observation-action-playback" aria-label="操作の再生">
            <strong><span aria-hidden="true">&gt;_</span> 操作の再生</strong>
            {actions.slice(0, visibleActionCount)
              .filter((action) => !(focusTargetId.startsWith("console-") && action.command))
              .map((action, index) => (
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
                <button
                  key={choice.id}
                  type="button"
                  className={quizProgress.selectedChoiceId === choice.id ? "is-selected" : undefined}
                  aria-pressed={quizProgress.selectedChoiceId === choice.id}
                  disabled={!playbackComplete || quizProgress.outcome !== null}
                  onClick={() => handleChoice(choice.id)}
                >
                  {choice.label}
                </button>
              ))}
            </div>
            {quizProgress.feedback && <p className="observation-quiz-feedback" role="status">{quizProgress.feedback}</p>}
            {quizProgress.outcome === null && (
              <button className="observation-skip-button" disabled={!playbackComplete} onClick={skipQuiz}>
                <SkipForward size={14} />スキップして推奨回答を見る
              </button>
            )}
          </section>
        )}
        <div className="observation-footer">
          <div className="observation-step-controls">
            <button type="button" className="observation-quiet-button" disabled={stepIndex === 0} onClick={() => goToStep(stepIndex - 1)}>
              <ArrowLeft size={14} />前へ
            </button>
            <label>
              手順
              <input
                type="number"
                min={1}
                max={tutorialSteps.length}
                step={1}
                aria-label="移動先の手順番号"
                value={stepNumberInput}
                onChange={(event) => setStepNumberInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") jumpToStep();
                }}
              />
              / {tutorialSteps.length}
            </label>
            <button
              type="button"
              className="observation-quiet-button"
              disabled={!Number.isInteger(Number(stepNumberInput)) || Number(stepNumberInput) < 1 || Number(stepNumberInput) > tutorialSteps.length}
              onClick={jumpToStep}
            >
              移動
            </button>
          </div>
          <div className="observation-footer-next">
            <span>{quizProgress.outcome === "correct" ? "判断できました" : quizProgress.outcome === "skipped" ? "推奨回答を確認しました" : "ハイライトされた画面を確認してください"}</span>
            <button className="observation-primary-button" disabled={!playbackComplete || (quiz !== undefined && quizProgress.outcome === null)} onClick={advance}>
              {stepIndex === tutorialSteps.length - 1 ? "学習内容を振り返る" : "次へ"}
              <ArrowRight size={15} />
            </button>
          </div>
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
