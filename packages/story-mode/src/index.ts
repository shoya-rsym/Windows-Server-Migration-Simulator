export interface TutorialStep {
  id: string;
  instruction: string;
  requiredEvents: string[];
  explanation: string;
}

export interface StoryAction {
  label: string;
  actor: string;
  command?: string;
  output: string[];
}

export interface StoryQuizChoice {
  id: string;
  label: string;
  correct: boolean;
  feedback?: string;
}

export interface StoryFailureBranch {
  title: string;
  impact: string;
  diagram: string[];
  cause: string;
  recovery: string;
}

export interface StoryFailureExample {
  title: string;
  description: string;
  impact: string;
}

export interface StoryPhase {
  id: string;
  title: string;
  startStep: number;
  endStep: number;
}

export interface StoryReviewSection {
  title: string;
  items: string[];
}

export interface StoryReview {
  flow: StoryReviewSection[];
  learningOutcomes: string[];
}

export interface StoryStep {
  tutorialStepId: string;
  aiComment: string;
  autoActions: StoryAction[];
  failureExample?: StoryFailureExample;
  quiz?: {
    question: string;
    choices: StoryQuizChoice[];
    answerExplanation: string;
  };
  failureBranch?: StoryFailureBranch;
}

export interface StoryModeDefinition {
  enabled: boolean;
  steps: StoryStep[];
  phases?: StoryPhase[];
  review?: StoryReview;
}

export function getActiveStoryPhase(phases: readonly StoryPhase[], stepNumber: number): StoryPhase | undefined {
  return phases.find((phase) => stepNumber >= phase.startStep && stepNumber <= phase.endStep);
}
