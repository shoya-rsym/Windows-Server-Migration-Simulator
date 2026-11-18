import type {
  ProjectBrief,
  ProjectDocument,
} from "@se-simulator/project-desk";
import type { ProjectLifecyclePhase, SESkill } from "@se-simulator/shared-engine";
import type { StoryPhase } from "@se-simulator/story-mode";

export interface DevelopmentChoice {
  id: string;
  label: string;
  score: number;
  benefit: string;
  risk: string;
  feedback: string;
}

export interface DevelopmentStep {
  id: string;
  phase: ProjectLifecyclePhase;
  title: string;
  question: string;
  facts: string[];
  skill: SESkill;
  choices: DevelopmentChoice[];
}

export const developmentProjectBrief: ProjectBrief = {
  users: 800,
  downtimeLimitMinutes: 0,
  downtimeWindow: "通常営業を継続",
  criticality: "Medium",
  components: ["ECサイト", "商品検索", "商品API", "商品DB", "在庫API", "利用者"],
  dependencies: [
    { id: "search-ui-api", from: "商品検索", to: "商品API", reason: "検索条件を送信する" },
    { id: "api-product-db", from: "商品API", to: "商品DB", reason: "商品情報を検索する" },
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
      { id: "request", title: "依頼内容", content: "利用者が目的の商品を見つけやすい検索機能を追加したい。対象商品、検索条件、並び順は未合意。" },
      { id: "constraint", title: "制約", content: "繁忙時間帯もサービスを継続する。既存の商品・在庫APIとの互換性を保つ。" },
    ],
  },
];

export const developmentStoryPhases: StoryPhase[] = [
  { id: "requirements", title: "要件定義", startStep: 1, endStep: 1 },
  { id: "design", title: "設計", startStep: 2, endStep: 2 },
  { id: "implementation", title: "実装・レビュー", startStep: 3, endStep: 4 },
  { id: "testing", title: "テスト", startStep: 5, endStep: 5 },
  { id: "release", title: "リリース", startStep: 6, endStep: 6 },
];

export const developmentSteps: DevelopmentStep[] = [
  {
    id: "clarify-search-requirements",
    phase: "requirements",
    title: "要望を検証可能な要件にする",
    question: "「商品を見つけやすくしたい」を具体化するため、最初に何を確認しますか？",
    facts: ["対象利用者: 一般購入者", "利用者数: 800人", "検索成功の定義: 未合意", "既存商品・在庫APIあり"],
    skill: "requirements",
    choices: [
      { id: "ask-goal", label: "利用者の困りごと、対象商品、成功とみなす検索結果を関係者と合意する", score: 3, benefit: "目的と受入条件を早期に揃えられる", risk: "要望の確認と合意に時間がかかる", feedback: "要望を機能へ直訳せず、利用者・業務上の課題と測定可能な成功条件を確認します。" },
      { id: "build-screen", label: "一般的な検索画面を先に作り、顧客に見てもらう", score: 1, benefit: "早く画面イメージを共有できる", risk: "対象や検索ルールが違えば手戻りになる", feedback: "画面案は有効ですが、何を解決するか・どう受け入れるかを確認してから試作範囲を決める方が安全です。" },
      { id: "copy-competitor", label: "競合サイトの検索機能を同じように実装する", score: 0, benefit: "参考例があり、検討を始めやすい", risk: "自社の利用者・商品・運用要件を満たす根拠がない", feedback: "他社機能は参考になりますが、自社の業務要件や受入条件の代わりにはなりません。" },
    ],
  },
  {
    id: "design-search-contract",
    phase: "design",
    title: "APIと品質条件を設計する",
    question: "検索条件や結果件数が未確定です。実装前に何を設計・合意しますか？",
    facts: ["在庫APIとの連携あり", "繁忙時間帯もサービス継続", "最大応答時間: 未定", "検索対象項目: 未合意"],
    skill: "design",
    choices: [
      { id: "define-contract", label: "検索項目・ページング・入力制限・エラー応答・性能目標をAPI契約として合意する", score: 3, benefit: "画面・API・DB・テストの前提を揃えられる", risk: "関係者間の調整と設計レビューが必要", feedback: "機能要件だけでなく応答時間やエラー時の振る舞いも、検証可能な契約にします。" },
      { id: "large-response", label: "最初は全商品を返し、画面側で絞り込む", score: 0, benefit: "APIの初期実装は単純になる", risk: "データ量・性能・情報公開範囲が管理できない", feedback: "応答量が増えると性能やデータ露出の問題が起きます。件数上限やページングを設計してください。" },
      { id: "database-first", label: "DBのインデックスだけ決め、API仕様は実装時に考える", score: 1, benefit: "早くDB作業に着手できる", risk: "要件・API・DBの前提がずれて手戻りしやすい", feedback: "DB設計だけで検索体験は決まりません。利用者要件とAPI契約から一貫して設計します。" },
    ],
  },
  {
    id: "implement-safe-search",
    phase: "implementation",
    title: "安全な実装方針を選ぶ",
    question: "利用者入力を検索APIへ渡す際、実装で優先することは何ですか？",
    facts: ["検索語は利用者入力", "商品名に記号を含む可能性あり", "入力長の上限: 未定"],
    skill: "development",
    choices: [
      { id: "validate-parameterize", label: "入力長・許容形式を検証し、DB問い合わせはパラメーター化する", score: 3, benefit: "入力不正や注入リスクを抑え、境界条件を試験できる", risk: "入力仕様とエラー応答を明確にする必要がある", feedback: "入力を信頼せず検証し、クエリ文字列へ直接連結しない設計にします。" },
      { id: "escape-only", label: "画面表示時だけ検索語をエスケープする", score: 1, benefit: "表示時の一部リスクを軽減できる", risk: "DB問い合わせや入力制限の安全性は別途必要", feedback: "出力時のエスケープだけではDB問い合わせを保護できません。入力検証とパラメーター化を行います。" },
      { id: "raw-query", label: "検索語をSQLへ直接連結し、問題があれば後から修正する", score: 0, benefit: "短時間で試作できる", risk: "注入や障害のリスクを本番へ持ち込む", feedback: "既知の入力境界を未対処のまま出荷する判断は避け、レビューとテストを通します。" },
    ],
  },
  {
    id: "review-design-and-code",
    phase: "implementation",
    title: "レビューで変更の影響を確認する",
    question: "レビュー担当者が確認すべき内容として最も適切なのはどれですか？",
    facts: ["商品検索APIを新設", "既存の商品・在庫APIを利用", "呼び出し元はWeb画面とバッチ"],
    skill: "review",
    choices: [
      { id: "review-contract-impact", label: "要件との一致、既存利用者への互換性、異常系、性能、テスト証跡を確認する", score: 3, benefit: "変更が周辺機能と品質条件へ与える影響を検出できる", risk: "観点を揃えたレビュー時間が必要", feedback: "コードの見た目だけでなく、契約・依存先・異常時・テストまで追跡します。" },
      { id: "review-style-only", label: "命名規則とフォーマットだけを確認する", score: 1, benefit: "読みやすさや一貫性を保ちやすい", risk: "仕様漏れや既存APIへの影響を見逃す", feedback: "スタイル確認は必要ですが、要件・互換性・異常系のレビューも必要です。" },
      { id: "approve-fast", label: "担当者が動作したと言っているのでレビューを省略する", score: 0, benefit: "リリースまでの時間を短縮できる", risk: "確認されていない不具合や影響を残す", feedback: "作成者の確認だけでは独立したレビューや受入条件の確認を代替できません。" },
    ],
  },
  {
    id: "test-search-acceptance",
    phase: "testing",
    title: "受入条件をテストで確かめる",
    question: "検索機能の受入試験に含めるべき観点はどれですか？",
    facts: ["商品名・カテゴリで検索予定", "0件の場合の表示: 未合意", "応答時間目標: 設計中"],
    skill: "testing",
    choices: [
      { id: "test-boundaries", label: "正常・0件・境界長・記号・不正入力・ページング・性能を合意条件に沿って試験する", score: 3, benefit: "業務動作と重要な境界・品質条件を確認できる", risk: "試験データと期待結果を準備する工数が必要", feedback: "受入条件から正常系、境界値、異常系、品質要件へ試験を導きます。" },
      { id: "happy-path", label: "一般的な商品名で検索できることだけを確認する", score: 1, benefit: "主要な利用経路を短時間で確認できる", risk: "空結果、入力境界、性能などの問題を見落とす", feedback: "正常系だけでなく、要件で定めた境界・異常系・性能条件も確認します。" },
      { id: "compile-only", label: "ビルドが成功すれば受入試験は不要とする", score: 0, benefit: "確認工数を省ける", risk: "利用者の要求や実行時動作を確認できない", feedback: "ビルド成功は実行時の業務動作や受入条件を満たした証明ではありません。" },
    ],
  },
  {
    id: "release-with-rollback",
    phase: "release",
    title: "リリースと監視を計画する",
    question: "繁忙期前に公開する際、リリース計画に含めるべきものは何ですか？",
    facts: ["通常営業を継続", "利用者数: 800人", "即時切戻しの手順: 未作成"],
    skill: "riskManagement",
    choices: [
      { id: "staged-release", label: "段階公開、監視指標、停止条件、切戻し担当と手順を事前に合意する", score: 3, benefit: "影響を抑え、問題時に判断可能な状態を作れる", risk: "監視・段階公開・連絡体制の準備が必要", feedback: "公開後の観測項目と中止条件を明確にし、復旧手順を担当者と事前確認します。" },
      { id: "big-bang", label: "全利用者へ一斉公開し、問い合わせを見てから判断する", score: 0, benefit: "公開作業を一度で終えられる", risk: "問題の影響範囲が広く、判断が遅れる", feedback: "一斉公開を選ぶなら、事前試験と明確な監視・切戻し条件が必要です。" },
      { id: "no-monitor", label: "リリース後は通常運用へ任せ、特別な監視はしない", score: 1, benefit: "追加の当番や監視設定が不要", risk: "初期障害や利用者影響の検知が遅れる", feedback: "変更直後は想定した動作・性能・エラーを監視し、対応責任者を明確にします。" },
    ],
  },
];
