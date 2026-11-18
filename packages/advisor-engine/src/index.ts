export interface AdvisorContext {
  projectSummary: string;
  evidence: string[];
  openQuestions: string[];
  currentPhase?: string;
}

export interface LearningAdvisor<TContext = AdvisorContext> {
  getAdvice(context: TContext): Promise<string>;
}

export class RuleBasedAdvisor implements LearningAdvisor {
  async getAdvice(context: AdvisorContext): Promise<string> {
    const advice = [
      context.currentPhase ? `現在の工程: ${context.currentPhase}` : "",
      context.evidence.length ? `確認済みの事実: ${context.evidence.join(" / ")}` : "まず根拠となる事実を一つ確認してください。",
      context.openQuestions.length ? `未確認事項: ${context.openQuestions.join(" / ")}` : "未確認事項がないか関係者と確認してください。",
      context.projectSummary ? `案件の目的: ${context.projectSummary}` : "",
    ].filter(Boolean);
    return advice.join("\n");
  }
}

export function createRuleBasedAdvisor(): LearningAdvisor {
  return new RuleBasedAdvisor();
}
