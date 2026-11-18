import type {
  ProjectBrief,
  ProjectDocument,
} from "@se-simulator/project-desk";
import type { LearningObjective, PlaybookSection, ProjectLifecyclePhase, SESkill } from "@se-simulator/shared-engine";
import type { StoryPhase } from "@se-simulator/story-mode";

export interface DevelopmentChoice {
  id: string;
  label: string;
  score: number;
  benefit: string;
  risk: string;
  feedback: string;
  outcome: string;
}

export interface DevelopmentStep {
  id: string;
  phase: ProjectLifecyclePhase;
  title: string;
  situation: string;
  question: string;
  facts: string[];
  documentIds: string[];
  judgmentPoints: string[];
  skill: SESkill;
  handoff: string;
  choices: DevelopmentChoice[];
}

export interface DevelopmentDecision {
  stepId: string;
  choice: DevelopmentChoice;
  evidenceIndexes: number[];
  rationale: string;
  consultation: string;
}

export const developmentLearningObjective: LearningObjective = {
  id: "development-judgment-case-study",
  title: "要件・設計・試験・公開判断を根拠に接続する",
  layer: "case-study",
  skills: ["requirements", "architecture", "testing", "communication", "riskManagement", "operation", "projectManagement", "decisionMaking"],
  proficiency: "participation",
  description: "新人〜中堅SEが、案件条件から重要事実を選び、相談先・判断理由・次工程への影響を説明できるようにする。",
};

export const developmentPlaybook: PlaybookSection[] = [
  { id: "clarify", title: "案件理解・要件", questions: ["利用者・業務目的・成功条件は何か", "対象外・例外・未決事項は何か"], outputs: ["要求と要件の整理", "代表的な受入条件"], reviewPoints: ["検証可能か", "顧客の言葉と判断が追跡できるか"], risks: ["曖昧な「使いやすい」だけで実装する"] },
  { id: "plan-design", title: "計画・設計", questions: ["不確実性を減らす調査は何か", "既存利用者への互換性影響はあるか"], outputs: ["前提付き見積", "設計方針とトレードオフ"], reviewPoints: ["測定・再試験・予備期間があるか", "品質目標と障害時動作があるか"], risks: ["未測定を確約し、QA期間から不足分を削る"] },
  { id: "test-release", title: "試験・公開", questions: ["受入条件からどの証跡が必要か", "No-Go・停止・切戻しの条件は何か"], outputs: ["試験結果と残課題", "段階公開・Go/No-Go記録"], reviewPoints: ["残障害の業務影響を確認したか", "監視・担当・停止訓練があるか"], risks: ["発生率だけで障害重大度を決める"] },
  { id: "operate", title: "運用・振り返り", questions: ["誰が何を見て、いつ相談するか", "公開後に何を学ぶか"], outputs: ["引継ぎ・初動手順", "公開後レビュー"], reviewPoints: ["担当者が手順を実行できるか", "改善要望と障害を分けているか"], risks: ["特定担当者だけが知っている状態で公開する"] },
];

export const developmentProjectBrief: ProjectBrief = {
  users: 800,
  downtimeLimitMinutes: 0,
  downtimeWindow: "通常営業を継続",
  criticality: "High",
  components: ["ECサイト", "商品検索", "商品API", "商品DB", "在庫API", "商品マスタ", "利用者"],
  dependencies: [
    { id: "search-ui-api", from: "商品検索", to: "商品API", reason: "検索条件を送信し、結果を表示する" },
    { id: "api-product-db", from: "商品API", to: "商品DB", reason: "商品名・カテゴリから商品を検索する" },
    { id: "api-stock", from: "商品API", to: "在庫API", reason: "検索結果に在庫状態を表示する" },
  ],
};

export const developmentProjectContext = {
  objective: "顧客が目的の商品へ早くたどり着ける検索を追加し、繁忙期の販売機会を増やす。",
  schedule: "2026-11-18開始、2026-12-30の販促開始までに公開判断が必要。",
  team: "顧客窓口、業務担当、Web開発、API開発、DB担当、QA、運用の7役割が関与。",
  constraints: [
    "通常営業を止めずにリリースする。",
    "既存Web画面と夜間バッチが利用する商品APIの互換性を保つ。",
    "初回公開後も検索結果、性能、エラーを運用担当が確認できること。",
  ],
  successCriteria: [
    "商品名・カテゴリの合意済み検索で期待する商品を表示する。",
    "合意した負荷条件で検索APIのp95応答時間が2秒以内。",
    "既存API利用者と夜間バッチに互換性問題がない。",
    "問題発生時に機能を停止し、担当者が原因調査を開始できる。",
  ],
};

export const developmentProjectDocuments: ProjectDocument[] = [
  {
    id: "search-request",
    title: "商品検索機能の追加依頼",
    category: "顧客要望",
    author: "EC事業責任者",
    receivedAt: "2026-11-18",
    sections: [
      { id: "request", title: "依頼内容", content: "利用者が目的の商品を見つけやすい検索機能を追加したい。対象商品、検索条件、並び順、検索成功の定義は未合意。" },
      { id: "business-goal", title: "背景", content: "販促期間中に商品を見つけられず離脱する利用者がいる。検索機能で販売機会を改善したいが、現状の離脱率や目標値は未計測。" },
      { id: "constraint", title: "制約", content: "繁忙時間帯もサービスを継続する。既存の商品・在庫APIとの互換性を保つ。" },
    ],
  },
  {
    id: "stakeholder-interview",
    title: "関係者ヒアリングメモ",
    category: "要件整理",
    author: "プロジェクトリーダー",
    receivedAt: "2026-11-20",
    sections: [
      { id: "users", title: "利用者と利用状況", content: "会員約800人が利用し、販促開始直後の同時アクセスは最大120人程度の見込み。利用者は商品名の一部やカテゴリから検索したい。" },
      { id: "business", title: "業務上の期待", content: "業務担当は検索後に在庫状態が分かることを希望。検索結果の並び順と在庫切れ商品を表示するかは未決定。" },
      { id: "acceptance", title: "受入判断", content: "顧客は「使いやすい」だけでは受入判断できないため、検索例と期待結果、応答時間、対象外条件を合意する必要がある。" },
    ],
  },
  {
    id: "api-contract",
    title: "既存商品API・連携一覧",
    category: "基本設計",
    author: "API担当",
    receivedAt: "2026-11-21",
    sections: [
      { id: "consumers", title: "利用者", content: "Web画面のほか、夜間バッチが商品APIの既存レスポンス項目を参照している。レスポンス項目の削除・意味変更は互換性に影響する。" },
      { id: "contract", title: "現行仕様", content: "商品APIにはページングがなく、呼び出し側は商品一覧を受け取る。検索用の新規エンドポイント追加か既存API拡張かは設計判断が必要。" },
      { id: "stock", title: "在庫連携", content: "在庫APIは商品ごとの照会に対応するが、商品ごとに逐次照会すると検索結果数に比例して通信回数が増える。" },
    ],
  },
  {
    id: "product-data-profile",
    title: "商品データ・検索性能調査",
    category: "技術調査",
    author: "DB担当",
    receivedAt: "2026-11-24",
    sections: [
      { id: "data-volume", title: "データ量", content: "商品マスタは約25万件。商品名には全角・半角、空白、記号の表記揺れがあり、商品データは毎日更新される。" },
      { id: "baseline", title: "現状計測", content: "試験環境で全件取得後に画面側で絞る試作は、120同時利用相当でp95が4.8秒。顧客の受入目標2秒を超えている。" },
      { id: "options", title: "改善候補", content: "DB側検索・適切な索引・ページングを先に検証する。キャッシュは更新頻度と陳腐化許容時間を決めてから効果を測る。" },
    ],
  },
  {
    id: "security-review",
    title: "開発セキュリティ標準",
    category: "セキュリティ",
    author: "セキュリティ担当",
    receivedAt: "2026-11-25",
    sections: [
      { id: "input", title: "入力とDB", content: "入力値はサーバー側で長さ・形式を検証する。SQLは値を文字列連結せず、パラメーター化する。" },
      { id: "output", title: "画面とログ", content: "画面表示時は文脈に応じて出力をエスケープする。ログには検索語そのものを不用意に記録せず、調査に必要な識別子・所要時間・結果件数を選ぶ。" },
    ],
  },
  {
    id: "qa-release-report",
    title: "受入試験・リリース判定メモ",
    category: "テスト・リリース",
    author: "QAリーダー",
    receivedAt: "2026-12-23",
    sections: [
      { id: "test-results", title: "試験結果", content: "合意済み検索例、0件、ページング、記号入力、120同時利用相当の試験を実施。修正版のp95は1.8秒で目標内。既存夜間バッチとの回帰試験も合格。" },
      { id: "open-defect", title: "残課題", content: "表記揺れデータの一部で同一商品が重複表示される。対象は全体の約0.4%と見積もられたが、販促対象商品への該当有無と販売影響は未確認。" },
      { id: "release-options", title: "リリース条件", content: "販促開始は7日後。機能フラグで公開範囲を制御できる。顧客承認、監視担当、停止条件、旧画面への戻し方を確認してGo/No-Goを判断する。" },
    ],
  },
  {
    id: "operations-handover",
    title: "運用引継ぎチェックリスト",
    category: "運用設計",
    author: "運用リーダー",
    receivedAt: "2026-12-24",
    sections: [
      { id: "metrics", title: "監視項目", content: "検索リクエスト数、p95応答時間、5xxエラー率、DB負荷、在庫API失敗率を既存機能と分けて確認できるようにする。" },
      { id: "response", title: "障害時対応", content: "担当者、連絡先、機能フラグ停止手順、ログの確認場所、顧客連絡の判断者をリリース前に確定する。" },
      { id: "review", title: "公開後レビュー", content: "公開後の検索利用率、0件率、エラー率を確認し、改善要望と不具合を分けて次回計画へ登録する。" },
    ],
  },
];

export const developmentStoryPhases: StoryPhase[] = [
  { id: "requirements", title: "要件定義", startStep: 1, endStep: 3 },
  { id: "planning", title: "計画", startStep: 4, endStep: 4 },
  { id: "design", title: "設計", startStep: 5, endStep: 6 },
  { id: "implementation", title: "実装・レビュー", startStep: 7, endStep: 8 },
  { id: "testing", title: "テスト", startStep: 9, endStep: 10 },
  { id: "release", title: "リリース", startStep: 11, endStep: 11 },
  { id: "operation", title: "運用", startStep: 12, endStep: 12 },
];

export const developmentConsultations: Record<string, { role: string; reason: string }> = {
  "clarify-search-requirements": { role: "業務担当・顧客", reason: "利用場面と検索成功の定義を合意する" },
  "prioritize-search-scope": { role: "顧客・PM", reason: "価値・期限・対象外の優先順位を合意する" },
  "define-acceptance-criteria": { role: "顧客・QA", reason: "検索例、対象外、測定条件を受入可能な形にする" },
  "estimate-and-plan": { role: "PM・DB担当・QA", reason: "不確実性、依存、検証と再試験の期間を再見積する" },
  "design-search-contract": { role: "API担当・バッチ担当", reason: "互換性、利用者、異常応答を確認する" },
  "performance-design": { role: "DB担当・API担当", reason: "ボトルネック、更新鮮度、再測定方法を確認する" },
  "implement-safe-search": { role: "セキュリティ担当・設計者", reason: "入力境界、パラメーター化、ログ方針を確認する" },
  "review-design-and-code": { role: "独立レビュー担当・QA", reason: "要件追跡、既存影響、試験証跡を確認する" },
  "test-search-acceptance": { role: "QA・業務担当", reason: "受入例、除外範囲、未実施領域を判断する" },
  "triage-release-defect": { role: "顧客・業務担当・QA", reason: "残障害の販売影響とGo/No-Go条件を承認する" },
  "release-with-rollback": { role: "運用・顧客・PM", reason: "公開拡大、停止、連絡責任を合意する" },
  "operations-handover": { role: "運用・開発・顧客窓口", reason: "監視、初動、停止、顧客連絡を訓練する" },
};

export const developmentEvidenceGuides: Record<string, { expectedIndexes: number[]; explanation: string }> = {
  "clarify-search-requirements": { expectedIndexes: [1, 2], explanation: "未計測の成功指標と未合意事項が、何を聞くかを決めます。" },
  "prioritize-search-scope": { expectedIndexes: [0, 1, 3], explanation: "期限・主要価値・QA準備を比べて初回範囲を決めます。" },
  "define-acceptance-criteria": { expectedIndexes: [0, 1, 3], explanation: "未計測・性能・対象外を測定可能な条件へ変換します。" },
  "estimate-and-plan": { expectedIndexes: [1, 2, 3], explanation: "性能差・未測定作業・QA/引継ぎ期間が見積前提です。" },
  "design-search-contract": { expectedIndexes: [0, 1, 2], explanation: "既存利用者、ページング、在庫照会量を契約として分けます。" },
  "performance-design": { expectedIndexes: [0, 2, 3], explanation: "現測定値と現方式、鮮度要件を同じ条件で比較します。" },
  "implement-safe-search": { expectedIndexes: [0, 1, 2], explanation: "入力・ログ・共有データの各境界を別々に扱います。" },
  "review-design-and-code": { expectedIndexes: [0, 1, 2], explanation: "既存利用者、在庫照会、要件証跡をレビュー対象にします。" },
  "test-search-acceptance": { expectedIndexes: [1, 2, 3], explanation: "性能目標、入力境界、回帰対象を試験へ追跡します。" },
  "triage-release-defect": { expectedIndexes: [2, 3], explanation: "発生率より残障害の販売影響と未確認状態を重視します。" },
  "release-with-rollback": { expectedIndexes: [0, 1, 3], explanation: "段階公開、通常営業、停止責任を公開計画へ反映します。" },
  "operations-handover": { expectedIndexes: [0, 1, 2], explanation: "新しい監視、停止訓練、公開後レビューを運用完了条件にします。" },
};

export const developmentSteps: DevelopmentStep[] = [
  {
    id: "clarify-search-requirements",
    phase: "requirements",
    title: "曖昧な要望を利用者課題に分解する",
    situation: "顧客からは「商品を見つけやすくしたい」と依頼されています。機能を急いで作る前に、誰のどの課題を解決するのかを確かめます。",
    question: "最初の打合せで、何を確認して案件の目的を揃えますか？",
    facts: ["販促開始まで6週間", "現状の離脱率・検索成功率は未計測", "検索対象・並び順・成功条件は未合意", "利用者は一般購入者"],
    documentIds: ["search-request", "stakeholder-interview"],
    judgmentPoints: ["要望と解決すべき業務課題を区別する", "利用者と成功条件を特定する", "未決事項を合意事項と混同しない"],
    skill: "requirements",
    handoff: "利用者像、検索したい場面、成功とみなす検索例、未決事項を要件バックログへ記録します。",
    choices: [
      { id: "ask-goal", label: "利用者の困りごと、利用場面、検索成功とみなす具体例を業務担当と合意する", score: 3, benefit: "解くべき課題と受入条件の出発点を揃えられる", risk: "関係者の時間を確保し、認識差を整理する必要がある", feedback: "この案件では離脱率などの現状値がありません。まず具体的な利用場面と検索例を聞き、後で測れる成功指標を合意するのが妥当です。", outcome: "機能要望を利用者課題と検証可能な検索例へ分解し、次工程で範囲を決められます。" },
      { id: "prototype-first", label: "検索画面の簡易試作を作り、顧客に見せながら要望を具体化する", score: 2, benefit: "言葉だけでは分かりにくい操作イメージを早く共有できる", risk: "試作の評価が先行し、対象商品や業務ルールの確認が後回しになる", feedback: "試作は有効な発見手段です。ただし、試作を確定要件と誤解されないよう、仮説・確認事項・対象外範囲を明示して並行してヒアリングします。", outcome: "画面の方向性は得られますが、受入条件を決めるための業務確認が別途残ります。" },
      { id: "copy-competitor", label: "競合サイトの一般的な検索機能を参考に、標準的な仕様として進める", score: 1, benefit: "具体例を使って検討を始めやすい", risk: "自社の商品属性・在庫運用・利用者の目的と合う保証がない", feedback: "競合例は質問を具体化する参考資料にはなりますが、自社の要件や合意の代用にはできません。", outcome: "機能案は作れますが、顧客の受入判断で大きな手戻りが起きる可能性があります。" },
    ],
  },
  {
    id: "prioritize-search-scope",
    phase: "requirements",
    title: "期限内に届ける範囲を合意する",
    situation: "6週間後の販促に間に合わせるため、検索項目を一度に増やすか、最小範囲を先行公開するかを関係者と決めます。",
    question: "検索条件・並び順・在庫表示の希望が膨らんだとき、どう範囲を決めますか？",
    facts: ["販促開始まで6週間", "商品名・カテゴリ検索は業務上の主要要望", "価格順・在庫のみ表示も追加要望", "QA・運用の試験準備期間が必要"],
    documentIds: ["stakeholder-interview", "search-request"],
    judgmentPoints: ["価値・期限・依存関係を比較する", "初回対象と次回候補を明示する", "受入条件と変更承認者を決める"],
    skill: "projectManagement",
    handoff: "初回リリース範囲、対象外機能、次回候補、変更時の承認者を記録し、工数と試験範囲へ引き継ぎます。",
    choices: [
      { id: "mvp-scope", label: "商品名・カテゴリ検索と合意済み検索例を初回範囲にし、追加条件は優先順位を付けて次回候補にする", score: 3, benefit: "価値の中心と試験可能な範囲を守りやすい", risk: "追加要望を見送る説明と次回計画が必要", feedback: "すべてを盛り込むのではなく、販促で必要な最小価値と受入可能な範囲を顧客と合意します。対象外を明記しないと、後から未完成と受け取られます。", outcome: "初回の納期・試験範囲を守りやすくなり、追加要望は別の優先順位判断として扱えます。" },
      { id: "parallel-all", label: "全要望を並行開発し、QA期間を短縮して販促前に揃える", score: 1, benefit: "要望を先送りせず一度に提供できる可能性がある", risk: "依存作業が増え、結合試験・受入確認・修正期間が不足する", feedback: "並行化で短縮できるのは一部作業です。API・データ・QAの依存と再試験期間を見積もり、根拠なしに試験を削らないでください。", outcome: "機能が揃う可能性はありますが、品質確認が間に合わない場合は販促直前の判断になります。" },
      { id: "no-scope-change", label: "追加要望をすべて断り、最初の依頼文にある検索だけを作る", score: 2, benefit: "スコープの膨張を抑え、見積を安定させやすい", risk: "業務上必要な在庫表示なども、影響確認せず除外する可能性がある", feedback: "変更抑制は有効ですが、追加要望を一律拒否するのではなく、価値・工数・依存・試験への影響を評価して顧客に選んでもらいます。", outcome: "納期は守りやすくなりますが、要望と初回範囲の合意記録が必要です。" },
    ],
  },
  {
    id: "define-acceptance-criteria",
    phase: "requirements",
    title: "受入条件と優先順位を決める",
    situation: "検索成功の定義が未計測のままだと、開発側と顧客側で「完成」の意味がずれます。機能・性能・対象外を受入条件へ落とします。",
    question: "顧客がリリース可否を判断できるよう、何を合意しますか？",
    facts: ["検索成功率の基準値はまだない", "応答時間の受入目標は2秒以内を提案中", "商品名の表記揺れは存在する", "対象外商品と在庫切れ表示は未決定"],
    documentIds: ["stakeholder-interview", "search-request"],
    judgmentPoints: ["期待入力と期待結果を具体例で合意する", "測定環境・負荷・閾値を定義する", "不確実な指標を確定値のように扱わない"],
    skill: "requirements",
    handoff: "受入条件をテストケースに追跡可能な形で記録し、測定できていない指標には計測計画を付けます。",
    choices: [
      { id: "example-based-acceptance", label: "代表検索例と期待商品、0件時の動作、対象外、120同時利用相当でp95 2秒以内を顧客と合意する", score: 3, benefit: "機能と性能の合否を同じ条件で判定できる", risk: "検索例・試験データ・測定条件の準備が必要", feedback: "この案件では基準値がありません。業務担当が確認できる検索例を作り、性能値は環境・負荷条件と一緒に合意します。", outcome: "QAが要件から試験を作成でき、顧客も結果を基に受入判断できます。" },
      { id: "metric-only", label: "p95 2秒以内だけを先に決め、検索結果の期待値は試験後に相談する", score: 2, benefit: "性能面の目標を先行して計測できる", risk: "速くても業務上正しい商品が出るか判断できない", feedback: "性能目標は重要ですが、機能の正しさを定める代表例も同時に合意しなければ完成を判定できません。", outcome: "性能試験は進められますが、業務受入の基準が残り、リリース判断が遅れる可能性があります。" },
      { id: "team-defined", label: "開発チームが一般的な検索動作を決め、完成後に顧客へ確認する", score: 1, benefit: "要件調整を待たずに実装へ着手できる", risk: "顧客が想定する検索結果と異なる場合に手戻りになる", feedback: "仮の基準を置く場合も、仮定として明示し、実装前に顧客の確認を得る必要があります。", outcome: "開発は始められますが、受入基準の相違が遅い段階で見つかります。" },
    ],
  },
  {
    id: "estimate-and-plan",
    phase: "planning",
    title: "見積と計画に不確実性を織り込む",
    situation: "データ調査で表記揺れと全件取得の遅さが見つかりました。確定作業と調査が必要な作業を分けて計画します。",
    question: "6週間の計画と見積を、どのように組み立てますか？",
    facts: ["商品データは約25万件", "試作p95は4.8秒、目標は2秒以内", "DB索引とデータ正規化の効果は未測定", "受入試験と運用引継ぎにも日程が必要"],
    documentIds: ["product-data-profile", "stakeholder-interview"],
    judgmentPoints: ["見積の前提・除外・依存を明記する", "不確実性を調査タスクとして見積もる", "QA・顧客確認・リリース準備の期間を確保する"],
    skill: "projectManagement",
    handoff: "性能調査の結果で見積を更新し、変更時の再見積・範囲調整・顧客承認の手順を設定します。",
    choices: [
      { id: "spike-and-reserve", label: "短い性能検証を先行し、測定結果と前提を基に実装・QA・予備期間を再見積する", score: 3, benefit: "大きな技術不確実性を早期に減らせる", risk: "検証で追加課題が見つかれば範囲調整が必要", feedback: "4.8秒から2秒への改善は確約できません。まず索引・ページング等を小さく計測し、結果を見て実現方式と日程を顧客と更新します。", outcome: "性能リスクが早く可視化され、販促前に範囲縮小や延期を選ぶ時間が残ります。" },
      { id: "fixed-estimate", label: "6週間で全機能を完了すると固定し、性能課題は実装担当の工夫に任せる", score: 1, benefit: "顧客に早く納期を提示できる", risk: "未測定の性能改善を見積に含めず、試験・修正期間を圧迫する", feedback: "納期を提示する際は、未検証の仮定と除外事項も明示してください。根拠のない固定見積は変更交渉を難しくします。", outcome: "初期計画は単純ですが、性能改善に時間がかかるとQAか公開日を削ることになります。" },
      { id: "cut-qa", label: "見積を6週間に合わせるため、受入試験と運用引継ぎを最小限にする", score: 0, benefit: "実装作業へ多くの時間を割り当てられる", risk: "業務・性能・運用上の問題を公開前に検出しにくい", feedback: "試験と引継ぎは残作業ではなく、受入と安全な運用のための成果物です。間に合わない場合は範囲や日程を再調整します。", outcome: "見かけの実装進捗は上がりますが、顧客受入と障害対応が公開後へ先送りされます。" },
    ],
  },
  {
    id: "design-search-contract",
    phase: "design",
    title: "API境界と既存利用者への影響を設計する",
    situation: "既存の商品APIはWeb画面だけでなく夜間バッチも使っています。新機能追加で既存利用者の契約を壊さない設計が必要です。",
    question: "商品検索APIを追加する際、どの設計方針を選びますか？",
    facts: ["既存レスポンス項目を夜間バッチが参照", "現行APIにはページングがない", "在庫APIを商品ごとに呼ぶと照会数が増える", "通常営業を継続する"],
    documentIds: ["api-contract", "stakeholder-interview"],
    judgmentPoints: ["既存契約と利用者を棚卸しする", "ページング・入力・エラー応答を明示する", "依存APIの呼出量と障害時動作を設計する"],
    skill: "architecture",
    handoff: "API契約、既存利用者の回帰確認、在庫連携の上限・タイムアウト・縮退方針を設計レビューへ提出します。",
    choices: [
      { id: "add-search-endpoint", label: "検索用エンドポイントを追加し、ページング・互換性・在庫連携の上限を契約化する", score: 3, benefit: "既存利用者への影響を分離し、検索要件を明示できる", risk: "エンドポイントと運用対象が増え、契約レビューが必要", feedback: "新規エンドポイントなら既存応答を保ちやすくなります。ただし、API数が増える運用コストと在庫照会の制御も設計します。", outcome: "既存バッチの契約を維持しながら検索を公開でき、回帰試験の対象も明確になります。" },
      { id: "extend-compatible", label: "既存APIへ任意の検索条件を追加し、既存レスポンスは維持したまま段階移行する", score: 2, benefit: "共通APIを再利用し、既存利用者の変更を抑えられる", risk: "検索用途と既存用途が混在し、応答負荷・責務が複雑になる", feedback: "互換性を保つ追加なら選択肢になります。既存呼出しの負荷影響、未指定時の動作、将来の仕様管理を計測・合意してください。", outcome: "API数を抑えられますが、既存画面やバッチの性能回帰を重点確認します。" },
      { id: "replace-contract", label: "既存APIを検索用に置き換え、Web画面とバッチも同時に新仕様へ更新する", score: 1, benefit: "仕様を一本化し、旧方式を整理できる", risk: "すべての利用者を同時に移行する調整・切戻しが必要", feedback: "一括変更は将来の単純化につながる場合もありますが、この案件では利用者と停止条件の調整が確認できていません。段階移行の可否を検討します。", outcome: "移行完了後は整理されますが、バッチが未対応だと既存業務まで停止する可能性があります。" },
    ],
  },
  {
    id: "performance-design",
    phase: "design",
    title: "性能課題を計測に基づいて解消する",
    situation: "試作のp95は4.8秒で、目標の2秒を超えています。キャッシュを先に入れるか、検索処理とデータアクセスを改善するかを選びます。",
    question: "最初に行う性能改善として、最も根拠を作りやすいのはどれですか？",
    facts: ["120同時利用相当でp95 4.8秒", "商品は25万件、毎日更新", "全件取得・画面側絞り込みの試作", "キャッシュ許容時間は業務未合意"],
    documentIds: ["product-data-profile", "api-contract"],
    judgmentPoints: ["測定値を再現し、遅い箇所を分解する", "更新頻度・鮮度と性能改善のトレードオフを確認する", "データ量や同時数を使った再試験を行う"],
    skill: "design",
    handoff: "ベースライン・改善内容・試験条件を記録し、同じ負荷で比較できる性能試験へ引き継ぎます。",
    choices: [
      { id: "measure-query", label: "DB検索・転送量・在庫照会を計測し、ページングと索引を検証して同一負荷で再測定する", score: 3, benefit: "ボトルネックと改善効果を分けて確認できる", risk: "計測・データ準備・複数回の試験に時間がかかる", feedback: "今の遅さは全件取得と画面側絞り込みで発生しています。まず処理時間と転送量を分解し、DB検索・索引・ページングの効果を測ります。", outcome: "性能改善の根拠が残り、p95目標に届かない場合も次の対策を選びやすくなります。" },
      { id: "cache-immediately", label: "検索結果を長時間キャッシュし、DBへのアクセスを減らす", score: 2, benefit: "同じ検索が多ければ応答時間とDB負荷を下げられる", risk: "毎日更新される商品・在庫情報が古く表示される可能性がある", feedback: "キャッシュは有効な候補です。商品・在庫ごとに鮮度要件、無効化、許容時間を決め、負荷試験で効果を確認してから範囲を広げます。", outcome: "負荷は下がる可能性がありますが、情報鮮度とキャッシュ無効化の運用が追加されます。" },
      { id: "scale-first", label: "アプリサーバーを増強し、アプリ側で全件検索する現方式を維持する", score: 1, benefit: "構成変更が少なく、短期的な処理能力を増やせる", risk: "DB転送量や非効率な検索が残り、台数・費用を増やしても目標未達の可能性がある", feedback: "増強は一時緩和策になり得ますが、計測せずに増やすとボトルネックがDBやネットワークに残ることがあります。", outcome: "短期的に改善しても、データ増加に伴う性能劣化と運用費の再評価が必要です。" },
    ],
  },
  {
    id: "implement-safe-search",
    phase: "implementation",
    title: "入力・DB・ログを安全に扱う",
    situation: "検索語は利用者入力で、記号を含む商品名もあります。検索処理とログ出力の両方に安全な扱いを組み込みます。",
    question: "実装方針として、セキュリティ標準と調査性を両立するのはどれですか？",
    facts: ["商品名に記号・表記揺れがある", "入力長の上限は要件で定義する必要がある", "検索語そのものはログへ不用意に残さない", "夜間バッチと共通の商品データを扱う"],
    documentIds: ["security-review", "api-contract"],
    judgmentPoints: ["サーバー側入力検証とDBパラメーター化を行う", "表示文脈に応じた出力処理を分ける", "ログの目的・保持・個人情報リスクを確認する"],
    skill: "development",
    handoff: "入力境界・エラー応答・ログ項目をコードレビューとテストケースへ落とし込みます。",
    choices: [
      { id: "validate-parameterize", label: "入力長・形式をサーバー側で検証し、DBはパラメーター化、画面出力は文脈に応じて処理する", score: 3, benefit: "入力・DB・画面の異なるリスクをそれぞれ制御できる", risk: "許容文字・長さ・エラー仕様の合意とテストが必要", feedback: "入力検証、SQLパラメーター化、出力時エスケープは別の境界対策です。ログへ検索語を残さず、件数や時間など調査に必要な情報を選びます。", outcome: "一般入力と異常入力の扱いを一貫させ、脆弱性確認と障害調査の両方が可能になります。" },
      { id: "escape-only", label: "画面表示だけエスケープし、検索語は調査しやすいよう全文ログへ記録する", score: 1, benefit: "画面表示の一部リスクを抑え、入力再現がしやすい", risk: "DB問い合わせの安全性は別問題で、ログに不要な利用者入力を蓄積する", feedback: "表示時のエスケープだけではDB問い合わせを守れません。全文ログの必要性・アクセス制御・保持期間も検討してください。", outcome: "表示上の一部問題は抑えますが、DB入力境界とログ上の情報管理が残ります。" },
      { id: "raw-query", label: "入力をSQLへ連結し、問題があればログを見て後から修正する", score: 0, benefit: "短時間で試作を進められる", risk: "入力により検索処理が意図しない動作をし、ログにも不要な値が残る", feedback: "既知の入力境界を未対処で出荷する判断は避けます。安全な実装と異常入力試験を公開条件に含めます。", outcome: "不正入力による障害・データアクセスリスクを残し、後からの原因調査もログ管理上の問題を生みます。" },
    ],
  },
  {
    id: "review-design-and-code",
    phase: "implementation",
    title: "変更レビューで依存先と証跡を追う",
    situation: "検索APIはWeb画面、夜間バッチ、商品DB、在庫APIに関係します。実装者の「動いた」という確認だけでは影響範囲を判定できません。",
    question: "レビューで限られた時間を使って優先確認する内容は何ですか？",
    facts: ["Web画面と夜間バッチが既存APIを利用", "在庫API照会数は商品数に応じて増える可能性", "入力検証・性能目標・異常時応答を要件化済み", "変更者とは別の担当者がレビュー可能"],
    documentIds: ["api-contract", "security-review", "product-data-profile"],
    judgmentPoints: ["要件から実装・試験へ追跡できるか確認する", "呼出し側との互換性と異常時動作を確認する", "指摘の重大度・対応・再確認を記録する"],
    skill: "review",
    handoff: "レビュー指摘を重大度・担当・期限・再確認結果つきで記録し、未解決項目をリリース判定へ渡します。",
    choices: [
      { id: "review-contract-impact", label: "要件との対応、既存バッチ互換性、入力・異常系、性能試験証跡を独立レビューする", score: 3, benefit: "利用者影響と非機能要件の未確認を見つけやすい", risk: "観点と証跡を揃えたレビュー時間が必要", feedback: "この変更は既存バッチと在庫連携に波及します。差分だけでなくAPI契約、異常応答、呼出し回数、受入試験結果を確認します。", outcome: "指摘の対応状況と未解決リスクを公開判断に使える状態で残します。" },
      { id: "style-first", label: "命名規則・フォーマットを確認し、機能確認は自動テストに任せる", score: 2, benefit: "短時間で読みやすさと基本的な不具合を確認できる", risk: "自動テストにない業務前提や既存利用者への影響を見逃す", feedback: "自動テストとスタイル確認は有効ですが、テストが要件やバッチ互換性を網羅しているかは別途確認します。", outcome: "基本品質は改善しますが、要件トレースと運用影響のレビューが残ります。" },
      { id: "author-approval", label: "実装担当者が手元で確認済みなので、レビュー完了として承認する", score: 0, benefit: "レビュー待ち時間を減らせる", risk: "独立した確認がなく、見落とし・確認条件の偏りを残す", feedback: "作成者自身の確認は必要ですが、独立レビューの代わりにはなりません。期限が厳しければ範囲や順番を調整します。", outcome: "未検出の仕様漏れが本番利用者や夜間バッチで初めて現れる可能性があります。" },
    ],
  },
  {
    id: "test-search-acceptance",
    phase: "testing",
    title: "受入条件から試験範囲を組み立てる",
    situation: "検索は一般的な商品名だけでなく、0件、表記揺れ、記号入力、ページング、負荷時の在庫連携も含めて確認します。",
    question: "QA期間が限られている場合、どのような試験計画にしますか？",
    facts: ["商品データ25万件", "受入目標は120同時利用相当でp95 2秒以内", "検索語に記号・表記揺れがある", "既存夜間バッチの回帰確認が必要"],
    documentIds: ["stakeholder-interview", "product-data-profile", "api-contract", "security-review"],
    judgmentPoints: ["受入条件と試験ケースを紐づける", "正常・境界・異常・性能・回帰を分ける", "テストデータと本番相当条件を説明可能にする"],
    skill: "testing",
    handoff: "試験結果・環境差・未実施範囲・既知障害を記録し、顧客受入とリリース判断に渡します。",
    choices: [
      { id: "test-traceable", label: "受入例、0件・境界入力、ページング、セキュリティ、負荷、既存バッチ回帰を要件に対応付けて試験する", score: 3, benefit: "機能・品質・互換性を証跡で説明できる", risk: "試験データと結果レビューの工数を確保する必要がある", feedback: "すべてを同じテストで確認するのではなく、単体・API連携・受入・性能の役割を分け、各受入条件の証跡を残します。", outcome: "未実施・不合格の条件が可視化され、顧客が残リスクを判断できます。" },
      { id: "sample-and-load", label: "代表検索例と負荷試験を優先し、全データ組合せはリスクに基づき絞る", score: 2, benefit: "限られたQA期間で高影響条件を重点確認できる", risk: "選んだ代表例が不十分だと、特定データの問題を見落とす", feedback: "リスクベースの絞り込みは妥当です。除外理由、対象外条件、残るリスクを顧客と共有し、表記揺れなど既知の弱点を重点サンプリングします。", outcome: "高リスクを重点確認できますが、未実施領域を受入条件と誤認しない管理が必要です。" },
      { id: "happy-path", label: "一般的な検索語が表示されることだけ確認し、ビルド成功をもって完了とする", score: 0, benefit: "短時間で基本的な動作と成果物を確認できる", risk: "性能、異常入力、バッチ互換性、データ偏りを判定できない", feedback: "ビルドと正常系確認だけでは受入条件を満たした証明になりません。期限内に実施できない場合は範囲・公開日を再判断します。", outcome: "公開後に初めて性能劣化や特定商品の不具合が分かる可能性が高くなります。" },
    ],
  },
  {
    id: "triage-release-defect",
    phase: "testing",
    title: "残障害の影響を調べてGo/No-Goを決める",
    situation: "性能目標と回帰試験は合格しました。一方、同一商品の重複表示が約0.4%で発生し、販促対象商品への影響はまだ不明です。",
    question: "販促開始6日前の時点で、最初に取るべき判断はどれですか？",
    facts: ["p95 1.8秒で目標内", "夜間バッチ回帰試験は合格", "重複表示は約0.4%と推定", "販促商品への該当有無・販売影響は未確認", "機能フラグで公開範囲を制御可能"],
    documentIds: ["qa-release-report", "product-data-profile"],
    judgmentPoints: ["発生頻度だけでなく業務影響を調べる", "回避策・限定公開・延期を比較する", "Go/No-Go条件と承認者を明確にする"],
    skill: "riskManagement",
    handoff: "障害の対象商品・影響・回避策・再試験結果を更新し、顧客承認とGo/No-Go議事録に添付します。",
    choices: [
      { id: "investigate-and-gate", label: "販促対象商品への該当と回避策を期限付きで調べ、承認済みの限定公開条件を満たす場合だけGoとする", score: 3, benefit: "影響範囲に基づいて限定公開・修正・延期を選べる", risk: "短期間でデータ確認と顧客判断を行う必要がある", feedback: "0.4%という割合だけでは重大度を決められません。販促商品への該当、検索結果の代替手段、売上影響を確認し、判断期限とNo-Go条件を先に合意します。", outcome: "限定公開に進む場合も、未確認リスクと停止条件を承認記録に残せます。" },
      { id: "fix-all-now", label: "重複を完全に解消してから公開し、修正範囲に関係なく全試験をやり直す", score: 2, benefit: "既知の重複を残さず品質を優先できる", risk: "販促日を逃す可能性があり、再試験範囲が過大になることもある", feedback: "延期は安全側の選択です。修正影響と回帰範囲を評価し、必要な再試験を明確にしたうえで、顧客に日程・業務影響を判断してもらいます。", outcome: "品質リスクは抑えられますが、販促日への影響と延期承認を早く確定する必要があります。" },
      { id: "release-on-rate", label: "0.4%は少ないため、販促開始に間に合うよう全利用者へ公開する", score: 0, benefit: "予定日を維持し、全利用者へ機能を提供できる", risk: "影響対象が売上重要商品でも発生頻度だけで軽視してしまう", feedback: "影響する商品と業務重要度が未確認です。頻度だけでGoを決めず、影響範囲・回避可能性・監視と停止条件を確認します。", outcome: "販促対象商品で問題が起きると、広い利用者へ同時に影響し、原因切分けも難しくなります。" },
    ],
  },
  {
    id: "release-with-rollback",
    phase: "release",
    title: "段階公開・停止条件・切戻しを準備する",
    situation: "機能フラグにより検索機能を限定公開できます。公開前に、監視の担当と止める基準を合意します。",
    question: "本番公開の進め方として、リスクと販促日程を両立する案はどれですか？",
    facts: ["機能フラグで利用者範囲を切替可能", "通常営業中に公開する", "p95・エラー率・DB負荷を監視可能", "即時停止手順と連絡担当は未確定"],
    documentIds: ["qa-release-report", "operations-handover"],
    judgmentPoints: ["公開単位と拡大条件を定義する", "監視閾値・確認時間・担当者を決める", "機能停止とデータ復旧を混同しない"],
    skill: "riskManagement",
    handoff: "Go判断後、段階ごとの観測結果を記録し、停止条件に到達した場合は担当者が機能フラグを戻します。",
    choices: [
      { id: "staged-release", label: "社内・限定利用者から段階公開し、合意した時間と指標を確認してから対象を広げる", score: 3, benefit: "初期影響を限定し、実利用の兆候を見ながら拡大できる", risk: "段階ごとの判断者・連絡・監視当番を確保する必要がある", feedback: "段階公開だけで安全になるわけではありません。p95・エラー率・検索結果の問題、観測時間、拡大承認者、停止担当をセットで決めます。", outcome: "異常の兆候を小さな対象範囲で検知し、次の公開段階へ進む根拠を残せます。" },
      { id: "all-at-once-with-rollback", label: "全利用者へ公開するが、監視当番と機能フラグ停止手順を事前に訓練する", score: 2, benefit: "一度で公開でき、即時停止の準備もできる", risk: "問題の検知まで全利用者が影響を受ける", feedback: "明確な監視と停止訓練があれば一斉公開も選択肢ですが、段階公開より初期影響が大きくなります。販促日程や利用者影響から選択理由を記録します。", outcome: "公開は迅速ですが、検知までの影響範囲が広く、停止判断の遅れが重要なリスクです。" },
      { id: "publish-no-watch", label: "公開後は問い合わせが来た場合だけ調査し、監視担当は通常当番に任せる", score: 0, benefit: "追加の当番・運用準備を省ける", risk: "初期障害や性能劣化の発見が利用者申告まで遅れる", feedback: "変更直後は通常監視だけでは新機能固有の問題を検知できないことがあります。担当・閾値・連絡先を公開条件にします。", outcome: "影響を把握した時点で既に複数利用者へ広がっている可能性があります。" },
    ],
  },
  {
    id: "operations-handover",
    phase: "operation",
    title: "運用へ引き継ぎ、公開後に学ぶ",
    situation: "開発完了は運用開始ではありません。障害時に誰が何を見て、どう停止・連絡するかを運用担当と確認します。",
    question: "運用引継ぎの完了条件として何を揃えますか？",
    facts: ["検索APIは新しい監視対象", "p95・5xx・DB負荷・在庫API失敗率が観測可能", "機能フラグ停止手順の訓練結果は未記録", "公開後の利用状況レビューを予定"],
    documentIds: ["operations-handover", "qa-release-report"],
    judgmentPoints: ["監視値に閾値・担当・対応を紐づける", "手順を実際に実行して確認する", "公開後の学びを次の改善へ記録する"],
    skill: "operation",
    handoff: "公開後レビューで利用率・0件率・性能・問い合わせを確認し、障害と改善要望を別々に管理します。",
    choices: [
      { id: "handover-and-rehearse", label: "監視閾値・通知先・一次対応・機能停止・顧客連絡を文書化し、運用担当と停止訓練を行う", score: 3, benefit: "担当交代後も同じ判断と初動ができる", risk: "訓練と手順レビューの時間が必要", feedback: "監視項目だけでなく、誰が閾値を見てどう対応するかが運用設計です。手順は文書を渡すだけでなく、実行できることを確認します。", outcome: "初動担当が指標と停止方法を確認済みとなり、公開後の対応開始を早められます。" },
      { id: "dashboard-only", label: "ダッシュボードを共有し、障害時の対応は既存の運用ルールで判断してもらう", score: 2, benefit: "既存運用の仕組みを再利用できる", risk: "新機能の閾値や停止担当が既存ルールで扱われるか不明", feedback: "既存ルールの再利用は有効です。ただし新しい指標・機能停止・顧客連絡が既存手順でカバーされるか、運用担当と確認してください。", outcome: "監視画面は見られますが、異常時の責任分界と新機能固有の対応が残る場合があります。" },
      { id: "developer-only", label: "公開後の問い合わせは開発担当へ個別に連絡し、運用資料は後日作成する", score: 0, benefit: "公開準備を短くできる", risk: "開発担当不在時に初動・停止・連絡が滞る", feedback: "特定個人への依存は継続運用のリスクです。最低限の連絡先・切分け・機能停止手順を公開前に整えます。", outcome: "担当者不在や情報不足により、影響が続いてから原因調査が始まる可能性があります。" },
    ],
  },
];
