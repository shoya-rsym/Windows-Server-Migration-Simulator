import type { Advisor, AdvisorContext } from "./models";

export class LocalRuleBasedAdvisor implements Advisor {
  async getAdvice(context: AdvisorContext): Promise<string> {
    const latestEvidence = [...context.recentCommands]
      .reverse()
      .flatMap((entry) => entry.output.map((line) => ({ entry, line })))
      .find(({ entry, line }) =>
        entry.isError || /error|failed|failure|503|ORA-\d+/i.test(line),
      );
    const openHypothesis = [...context.hypotheses].reverse().find((note) => note.status === "open");
    const modeInstruction = context.mode === "expert"
      ? "障害の原因を決めつけず、ログと構成の証拠で仮説を検証しましょう。"
      : context.mode === "advanced"
        ? "症状から切り分け、変更前に観測結果を記録しましょう。"
        : "調査結果を構成資料と照らし合わせ、依存関係を整理しましょう。";
    const nextCheck = context.server.role === "database"
      ? "lsnrctl status でListenerを確認し、接続先DBの状態とデータ世代を比較してください。"
      : context.server.role === "dns"
        ? `nslookup ${context.scenario.assets.dns[0]?.name ?? "<サービス名>"} で名前解決先を確認し、Aレコード・TTL・クライアントキャッシュを比較してください。`
        : "eventvwr.msc と services.msc を確認し、JDBC接続先・Resin設定・サービス状態のうち、症状と一致するものを一つずつ検証してください。";
    const evidence = latestEvidence ? `直近の観測: ${latestEvidence.line}` : "まだ実行結果がありません。まず現在のサーバー状態を一つ確認してください。";
    const hypothesisAdvice = openHypothesis
      ? `仮説「${openHypothesis.text}」は、反証できる確認を一つ選んでから判定してください。`
      : "確認結果を仮説メモへ記録し、事実と推測を分けてください。";
    const projectGuidance = context.scenario.advisorContext.trim();

    return [modeInstruction, evidence, nextCheck, hypothesisAdvice, projectGuidance && `案件の視点: ${projectGuidance}`]
      .filter((line): line is string => Boolean(line))
      .join("\n");
  }
}

export function createLocalAdvisor(): Advisor {
  return new LocalRuleBasedAdvisor();
}
