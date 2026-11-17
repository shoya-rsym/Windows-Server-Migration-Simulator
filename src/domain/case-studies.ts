export type CaseStudyDifficulty = "easy" | "normal" | "hard";

export type CaseJudgmentDimension =
  | "technicalJudge"
  | "operationJudge"
  | "riskJudge"
  | "communicationJudge"
  | "rollbackJudge";

export interface CaseStudyConditions {
  users: number;
  downtimeMinutes: number;
  systemType: string;
  databases?: string[];
  dependencies?: string[];
  details: string[];
}

export interface CaseQuestion {
  id: string;
  question: string;
  choices: string[];
  highestFitChoices: number[];
  choiceReviews: CaseChoiceReview[];
  explanation: string;
  consequenceGood: string;
  consequenceBad: string;
  seniorReview: string;
  judgmentDimension: CaseJudgmentDimension;
  reviewBasis: string[];
  rationaleFactors: string[];
  glossaryTerms: string[];
  rehearsal?: {
    result: string;
    implication: string;
  };
  failureScenario: {
    title: string;
    description: string;
    impact: string;
    flow: string[];
  };
}

export interface CaseChoiceReview {
  benefit: string;
  cost: string;
  fit: number;
}

export interface CaseStudyScenario {
  id: string;
  title: string;
  category: string;
  difficulty: CaseStudyDifficulty;
  background: string;
  conditions: CaseStudyConditions;
  questions: CaseQuestion[];
}

export interface CaseStudyAnswer {
  caseId: string;
  judgmentDimension: CaseJudgmentDimension;
  choiceIndex: number;
  fit: number;
  rationaleFactors: string[];
  rationale: string;
}

export interface CaseJudgmentScore {
  points: number;
  maxPoints: number;
  total: number;
  percentage: number | null;
}

export type CaseJudgmentScores = Record<CaseJudgmentDimension, CaseJudgmentScore>;

const difficultyLabels: Record<CaseStudyDifficulty, string> = {
  easy: "初級",
  normal: "標準",
  hard: "上級",
};

interface CaseVariant {
  background: string;
  users: number;
  downtimeMinutes: number;
  systemType: string;
  databases?: string[];
  dependencies: string[];
  details: string[];
  question: string;
  choices?: TradeoffOption[];
  fitScores?: [number, number, number, number];
  explanation?: string;
  seniorReview?: string;
  rehearsal?: {
    result: string;
    implication: string;
  };
}

interface CaseTemplate {
  id: string;
  title: string;
  category: string;
  dimension: CaseJudgmentDimension;
  choices: string[];
  correctAnswers: number[];
  explanation: string;
  consequenceGood: string;
  consequenceBad: string;
  seniorReview: string;
  failureTitle: string;
  failureDescription: string;
  failureImpact: string;
  failureFlow: string[];
  variants: Record<CaseStudyDifficulty, CaseVariant>;
}

interface TradeoffOption {
  text: string;
  benefit: string;
  cost: string;
}

const tradeoffOptions: Record<string, TradeoffOption[]> = {
  DNS: [
    { text: "利用者経路ごとに名前解決先を確認し、旧TTLの満了を確認してから段階的に切り替える", benefit: "利用者間の接続先のばらつきを抑え、観測結果に基づいて進められる", cost: "事前調整と複数拠点での確認に時間がかかる" },
    { text: "予定どおり切り替え、監視と問い合わせ件数を見ながら短い間隔で継続判断する", benefit: "停止枠を維持し、影響の有無を早期に把握できる", cost: "キャッシュ残留が大きいと、一時的に接続先が分かれる" },
    { text: "切替枠を延長または延期し、DNS担当と利用部門の確認時間を確保する", benefit: "不確実なキャッシュや承認を解消してから作業できる", cost: "顧客・利用部門の再調整と日程変更が必要になる" },
    { text: "旧環境を期限付きで維持し、書込み制御・利用者誘導・切戻し条件を決めて段階移行する", benefit: "接続先が残る利用者への代替経路を確保できる", cost: "新旧の運用・データ整合性管理が複雑になる" },
  ],
  "Active Directory": [
    { text: "利用者とサービスアカウントを分け、ドメイン到達性・グループ・権限を代表ケースで確認する", benefit: "影響範囲を絞り、過剰な権限変更を避けられる", cost: "複数の認証主体と経路を調査する工数がかかる" },
    { text: "現行の認証設定を維持して切り替え、認証ログを監視しながら対象を限定して確認する", benefit: "大規模な構成変更を避けて短期間で切替できる", cost: "事前検証が不足すると障害発見が本番後になる" },
    { text: "認証依存の確認が終わるまで切替を延期し、AD担当を交えた疎通試験を行う", benefit: "認証経路の不明点を残したまま本番化するリスクを下げる", cost: "関係者調整と利用者への日程再周知が必要になる" },
    { text: "対象ユーザーを限定した段階切替を行い、失敗時の旧経路と権限復旧手順を準備する", benefit: "全利用者への一斉影響を避けながら実環境で確認できる", cost: "新旧ポリシー・権限を並行管理する期間が生じる" },
  ],
  Oracle: [
    { text: "停止可能時間・更新量を実測し、Data Pump等の停止移行が枠内に収まる条件を確認する", benefit: "構成を単純に保ち、データ移行の手順と責任範囲を明確にできる", cost: "業務停止と十分な事前リハーサル時間が必要になる" },
    { text: "停止枠内の切替を前提に、対象範囲を絞った移行を実施して監視付きで進める", benefit: "日程・費用を抑え、停止枠を守れる可能性がある", cost: "移行時間や互換性の余裕が小さく、超過時の判断が難しい" },
    { text: "更新量と停止上限が合わなければ、レプリケーション等の方式をDBAと評価して日程を再計画する", benefit: "短い停止枠や大容量DBに合わせた同期方式を検討できる", cost: "構築・監視・ライセンス・運用のコストと複雑性が増す" },
    { text: "移行対象を分割し、優先業務を先行して残りは合意した段階で移行する", benefit: "一度に扱う変更範囲を減らし、段階的に検証できる", cost: "依存関係と一時的な新旧連携の設計が必要になる" },
  ],
  "Data Pump": [
    { text: "事前リハーサルを計測し、更新停止後の最終同期・件数照合まで含めて実行可能性を確認する", benefit: "実測時間とデータ整合性を根拠に切替可否を判断できる", cost: "リハーサル環境・担当者・停止調整の工数が必要になる" },
    { text: "初回Import後に短い停止枠で最終差分を反映し、重要データを優先して照合する", benefit: "業務停止を限定しつつ更新差分を反映できる", cost: "差分抽出・反映方法が不十分だと欠損を見逃す" },
    { text: "差分量・所要時間が枠に収まらない場合は切替を延期し、同期方式と停止計画を見直す", benefit: "未検証の移行を本番で強行するリスクを避けられる", cost: "日程変更と利用者・関係者の再調整が必要になる" },
    { text: "重要表を先に照合し、残りは合意した検証時間内にサンプリングと業務試験で確認する", benefit: "停止枠を意識しながら重要データの異常を優先検出できる", cost: "全件照合ではないため、サンプリング設計と残余リスクの承認が要る" },
  ],
  JDBC: [
    { text: "全APノードのJDBC接続先を照合し、保存後に新DBへの接続と試験書込みを確認する", benefit: "接続先の取り違えを切替前に検出し、証跡を残せる", cost: "ノードごとの設定確認と試験データの後処理が必要になる" },
    { text: "接続先変更を先行して適用し、接続プールを再生成して監視付きで切り替える", benefit: "切替当日の作業を減らし、早めに疎通確認できる", cost: "本番経路へ早く影響し、設定差分の管理が必要になる" },
    { text: "DB接続設定の不一致が解消するまで本番切替を保留し、担当者立会いで再試験する", benefit: "誤ったDBへの書込みを避けられる", cost: "切替延期と関係者の再調整が発生する" },
    { text: "段階的にAPノードを切り替え、接続先・書込み・プール状態をノードごとに確認する", benefit: "問題発生時に対象ノードを限定しやすい", cost: "一時的な混在状態とデータ整合性の管理が必要になる" },
  ],
  "利用者周知": [
    { text: "対象業務・日時・停止影響・事前準備・問い合わせ先を明示して複数経路で事前周知する", benefit: "利用者が業務影響を理解し、必要な準備を行える", cost: "対象者の棚卸しと文面確認に時間がかかる" },
    { text: "既存の標準連絡経路で要点を早めに通知し、未達・問い合わせを追跡する", benefit: "迅速に広く知らせ、標準運用に沿って記録できる", cost: "複雑な対象者や外部利用者が配信対象から漏れる可能性がある" },
    { text: "影響範囲と時間が確定するまで通知を保留し、業務責任者と再計画する", benefit: "不確かな予定を誤って確約するのを防げる", cost: "通知が遅れて利用者の準備時間を短くする" },
    { text: "重要利用者へ先行連絡し、全体通知は確定情報とFAQを揃えて段階的に行う", benefit: "影響の大きい部門と早期に調整できる", cost: "複数回の連絡を管理し、説明内容の一貫性を保つ必要がある" },
  ],
  "Go/No-Go": [
    { text: "必須条件・証跡・残リスクを確認し、業務責任者を含む判定者がGo/No-Goを記録する", benefit: "判断根拠と責任者を共有し、未完了事項を可視化できる", cost: "関係者を揃える時間と、条件未達時に止める決断が必要になる" },
    { text: "合意済みの停止枠を優先し、未完了項目を担当・期限付きで管理して限定的に進める", benefit: "全ての軽微な残項目で日程を止めずに済む", cost: "残項目の影響評価と明示的な受容判断が欠かせない" },
    { text: "未完了の必須条件がある場合はNo-Goとし、解消後の再判定を設定する", benefit: "重大な不確実性を本番へ持ち込まない", cost: "延期による業務・顧客・要員の再調整が発生する" },
    { text: "影響を限定した段階切替を提案し、監視閾値と即時中断条件を合意する", benefit: "全体切替前に実環境で影響を観測できる", cost: "二重運用・切替制御・監視の準備負荷が増える" },
  ],
  "切戻し": [
    { text: "合意済み閾値と残り時間を確認し、責任者・DBA・業務側でデータ状態を含めて判断する", benefit: "影響と復旧可能性に基づく一貫した判断ができる", cost: "関係者の即時招集と迅速な状況共有が必要になる" },
    { text: "復旧見込みが期限内なら対象を絞って修正し、短い間隔で継続可否を再評価する", benefit: "原因が限定されている場合は切戻しコストを避けられる", cost: "判断期限を超えないよう監視と中止条件が必要になる" },
    { text: "影響閾値または判定期限を超えたら新規更新を止め、承認の上で切り戻す", benefit: "利用者影響の拡大を抑え、計画された復旧経路を使える", cost: "日程・顧客影響が生じ、新環境の更新差分を処理する必要がある" },
    { text: "書込みを一時保留し、データ保全と影響範囲の把握後に続行・切戻しを選ぶ", benefit: "不整合を増やさず判断材料を確保できる", cost: "業務停止が続き、保留中のデータ処理を管理する必要がある" },
  ],
  "証明書": [
    { text: "クライアント視点で名前・期限・チェーン・秘密鍵・バインドを検証し、更新担当も決める", benefit: "利用者経路と運用期限の両方を確認できる", cost: "複数クライアントと権限を含む検証準備が必要になる" },
    { text: "現行証明書構成を維持して切り替え、主要クライアントのTLS監視を強化する", benefit: "構成変更を抑えて既存運用を活用できる", cost: "ホスト名やチェーン差異を見逃すと利用者環境で失敗する" },
    { text: "証明書チェーンまたは秘密鍵の検証が未完了なら切替を延期して再発行・再試験する", benefit: "信頼できないTLS状態で公開することを避けられる", cost: "証明書発行者や顧客の調整で日程が延びる" },
    { text: "影響の少ない経路で先行試験し、問題なければ段階的にバインドを切り替える", benefit: "クライアント差分を段階的に見つけられる", cost: "一時的に新旧証明書・経路の併存を管理する必要がある" },
  ],
  "バッチ": [
    { text: "実行ユーザー・時刻・作業フォルダー・権限・出力・終了コードを本番相当で試験する", benefit: "定義だけでなく業務成果物まで確認できる", cost: "試験データ・アクセス権・後処理を準備する必要がある" },
    { text: "初回は監視付きで予定どおり実行し、担当者がログと成果物を確認する", benefit: "移行直後の運用負荷を抑えて実際の実行結果を確認できる", cost: "事前試験で見つかるはずの失敗が本番時間帯に出る可能性がある" },
    { text: "実行条件や重複防止が不明なジョブは有効化せず、業務担当と実行時刻を再調整する", benefit: "誤実行・二重送信による業務影響を防ぎやすい", cost: "帳票や連携が遅延し、利用部門への連絡が必要になる" },
    { text: "ジョブを段階的に有効化し、依存順・重複防止・監視通知を一件ずつ確認する", benefit: "障害の発生箇所を限定し、連鎖実行を防ぎやすい", cost: "旧新タスクの状態と一時運用を丁寧に管理する必要がある" },
  ],
};

const rationaleFactorLabels = [
  "利用者数",
  "停止可能時間",
  "DB容量・更新量",
  "影響範囲",
  "切戻し時間",
  "顧客・利用部門の要望",
  "SLA・サービス条件",
];

export const caseGlossary = [
  { term: "権威DNS", definition: "ドメイン名の正式なDNSレコードを管理し、問い合わせに対して確定した情報を返すDNSサーバーです。", terms: ["権威DNS"] },
  { term: "TTL", definition: "DNS応答をキャッシュしてよい時間です。86400秒は24時間に相当し、短縮後も旧TTLのキャッシュ満了を見込む必要があります。", terms: ["TTL"] },
  { term: "DNSキャッシュ", definition: "名前解決の結果を一時保存した情報です。切替後も保存済みの旧IPを返すことがあります。", terms: ["DNSキャッシュ", "キャッシュ"] },
  { term: "Data Pump", definition: "Oracle Databaseの論理データ移行機能です。Export/Import実行後の更新差分と整合性確認も移行計画に含めます。", terms: ["Data Pump", "Export", "Import"] },
  { term: "差分同期", definition: "初回移行後に発生した追加・更新データを移行先へ反映する作業です。更新停止点と同期完了の検証が必要です。", terms: ["差分同期", "最終同期"] },
  { term: "JDBC", definition: "Javaアプリケーションがデータベースへ接続するための標準APIです。接続先設定はWeb用DNS切替とは独立しています。", terms: ["JDBC"] },
  { term: "接続プール", definition: "DB接続を再利用する仕組みです。接続先設定変更後に古い接続が残る場合は再生成・再起動を検討します。", terms: ["接続プール"] },
  { term: "Active Directory", definition: "ユーザー・グループ・コンピューターの認証やポリシーを管理するディレクトリサービスです。", terms: ["Active Directory", "AD"] },
  { term: "サービスアカウント", definition: "バッチやサービスが人の操作なしで処理を実行するためのアカウントです。権限と資格情報を個別に確認します。", terms: ["サービスアカウント"] },
  { term: "Go/No-Go", definition: "定めた必須条件・残リスク・業務影響を確認し、本番作業を進めるか止めるかを決める判定です。", terms: ["Go/No-Go", "Go", "No-Go"] },
  { term: "切戻し", definition: "切替後の障害時に旧環境へ戻す手順です。通信経路だけでなく、切替後のDB更新をどう扱うかも必要です。", terms: ["切戻し"] },
  { term: "証明書チェーン", definition: "サーバー証明書から中間CA・ルートCAへ連なる信頼関係です。中間証明書が配信されないと一部クライアントで失敗します。", terms: ["証明書チェーン", "中間証明書"] },
  { term: "冪等性", definition: "同じ処理を複数回実行しても結果が重複・変化しない性質です。バッチの再試行や外部送信で重要です。", terms: ["冪等性", "重複防止"] },
  { term: "リハーサル", definition: "本番と同等の手順・データ量で事前実行し、時間・手順・失敗条件を実測する練習です。", terms: ["リハーサル", "試験", "実測"] },
];

const templates: CaseTemplate[] = [
  {
    id: "dns-ttl",
    title: "長いTTLのまま迎える切替日",
    category: "DNS",
    dimension: "riskJudge",
    choices: [
      "DNS担当にTTL短縮の反映時刻と旧値のキャッシュ満了を確認し、条件が整ってから切替判定する",
      "切替時にAレコードだけ新サーバーへ変更し、利用者側の更新は待つ",
      "各利用者へ端末のDNSキャッシュ削除を依頼してから切り替える",
      "TTLは名前解決の時間なので、移行日程には影響しないと判断する",
    ],
    correctAnswers: [0],
    explanation: "TTLは利用者や中継DNSが古い接続先を保持する時間に関係します。切替当日の変更だけでは、旧IPを参照する利用者が残る可能性があります。",
    consequenceGood: "旧レコードのキャッシュが残る時間を見込み、切替後の接続先が利用者間で分かれるリスクを下げられます。",
    consequenceBad: "旧DNSキャッシュを使う利用者が旧APへ接続し、画面エラーや更新先の分散が発生します。",
    seniorReview: "TTLの値だけでなく、誰がいつ変更し、どの時点で旧値のキャッシュが満了したと確認するかまで計画に落としましょう。",
    failureTitle: "利用者の接続先が分かれる",
    failureDescription: "DNS切替後も一部クライアントのキャッシュに旧APのIPアドレスが残っています。",
    failureImpact: "問い合わせが増え、旧AP・新APのどちらに更新が入ったか確認できなくなるおそれがあります。",
    failureFlow: ["利用者", "旧DNSキャッシュ", "旧AP", "新APとの状態不一致"],
    variants: {
      easy: {
        background: "小規模な社内システムの移行です。DNSレコードのTTLが長いまま、今夜切替を予定しています。",
        users: 80, downtimeMinutes: 120, systemType: "社内Webシステム",
        dependencies: ["社内DNS", "APサーバー"],
        details: ["TTL: 86400秒", "切替予定: 本日22:00", "DNS変更担当: ネットワーク担当"],
        question: "切替前にまず確認・調整すべきことは何ですか？",
      },
      normal: {
        background: "複数拠点の利用者がいるシステムです。切替まで3日ありますが、DNS変更申請の完了連絡は届いていません。",
        users: 2000, downtimeMinutes: 90, systemType: "複数拠点の業務システム",
        dependencies: ["拠点DNSキャッシュ", "社内DNS", "APサーバー"],
        details: ["現在のTTL: 86400秒", "切替予定: 3日後22:00", "変更申請の状態: 未確認"],
        question: "切替可否を判断するために、次に取るべき行動は何ですか？",
      },
      hard: {
        background: "利用者が多く停止枠も短い案件です。TTL短縮を依頼したという記録はありますが、反映結果と旧キャッシュの満了時刻が不明です。",
        users: 5000, downtimeMinutes: 15, systemType: "24時間運用の顧客ポータル",
        dependencies: ["権威DNS", "拠点DNSキャッシュ", "ロードバランサー", "APサーバー"],
        details: ["記録上のTTL: 86400秒", "切替予定: 2時間後", "TTL短縮の反映確認: なし"],
        question: "このままGo判定を出す前に、最も重要な確認は何ですか？",
      },
    },
  },
  {
    id: "dns-split",
    title: "切替後も旧IPへ向かう利用者",
    category: "DNS",
    dimension: "operationJudge",
    choices: [
      "権威DNSと複数の利用者経路で名前解決先を確認し、残存キャッシュの影響範囲と待機・切戻し条件を判断する",
      "全利用者に端末のDNSキャッシュ削除を一斉に依頼し、他の確認は省略する",
      "新APが正常なら、旧IPを参照する利用者は無視して作業を完了する",
      "新旧両方のAPで書込みを受け付け、DNSが自然に収束するまで併用する",
    ],
    correctAnswers: [0],
    explanation: "DNS切替では権威DNSの変更だけでなく、キャッシュ・利用者経路・新旧環境の状態を確認します。利用者側のキャッシュは一律に削除できるとは限りません。",
    consequenceGood: "接続先のばらつきと影響範囲を把握し、待機または切戻しを合意した条件で実施できます。",
    consequenceBad: "利用者ごとに接続先が異なる状態を見逃し、データ更新の分散や二重運用を招く可能性があります。",
    seniorReview: "権威DNSの値が正しいことと、利用者が新環境へ到達できていることは別の確認です。",
    failureTitle: "切替後も旧環境へ接続する端末が残る",
    failureDescription: "一部の社内DNS・端末キャッシュが旧IPを返し、利用者ごとに接続先が異なっています。",
    failureImpact: "新旧環境間で業務データの差が生じ、障害の切り分けと切戻しが難しくなります。",
    failureFlow: ["利用者", "旧DNSキャッシュ", "旧AP", "新APとの状態不一致"],
    variants: {
      easy: {
        background: "DNSレコードは新APへ変更済みです。利用者から一部だけログイン画面が古いとの連絡がありました。",
        users: 120, downtimeMinutes: 60, systemType: "社内ポータル",
        dependencies: ["社内DNS", "APサーバー"],
        details: ["権威DNS: 新APを返す", "問い合わせ: 旧画面が表示される利用者が数名"],
        question: "最初に比較すべき情報は何ですか？",
      },
      normal: {
        background: "本社では新APへ接続できていますが、支店から旧APへ接続する報告があります。TTLは事前短縮済みです。",
        users: 1200, downtimeMinutes: 45, systemType: "本社・支店の業務システム",
        dependencies: ["本社DNS", "支店DNS", "VPN", "APサーバー"],
        details: ["本社: 新APへ接続", "支店: 旧APへ接続との報告", "TTL短縮: 3日前に実施"],
        question: "現象を限定するため、どの調査を優先しますか？",
      },
      hard: {
        background: "DNS切替後に一部利用者が旧APへアクセスし、更新処理も開始しています。新旧の更新先が混在する可能性があります。",
        users: 4500, downtimeMinutes: 20, systemType: "顧客向け受発注システム",
        dependencies: ["権威DNS", "拠点DNS", "APサーバー", "Oracle DB"],
        details: ["旧APアクセス: 15%との監視報告", "新旧DBの書込み状態: 未確認", "切替後の経過: 12分"],
        question: "影響を拡大させないために、次に行う判断は何ですか？",
      },
    },
  },
  {
    id: "ad-membership",
    title: "移行後に一部利用者がログインできない",
    category: "Active Directory",
    dimension: "technicalJudge",
    choices: [
      "旧新環境の認証経路、利用者グループ、サービスアカウント権限を比較し、影響範囲を切り分けて検証する",
      "全利用者のパスワードを一括初期化する",
      "APサーバーのローカル管理者権限を全利用者に付与する",
      "認証失敗の記録を確認せず、アプリケーションを再起動する",
    ],
    correctAnswers: [0],
    explanation: "AD認証の移行では、ドメイン到達性、グループ所属、サービスアカウント、GPOなど複数の依存を確認します。症状だけで全員の資格情報を変更してはいけません。",
    consequenceGood: "影響するユーザー・グループと認証経路を特定し、最小限の修正で再試験できます。",
    consequenceBad: "不要な権限付与やパスワード変更が広がり、セキュリティ事故や二次障害につながります。",
    seniorReview: "利用者本人の認証と、アプリケーションが使うサービスアカウントの認証を分けて確認しましょう。",
    failureTitle: "ログイン障害が長引き権限も過剰になる",
    failureDescription: "認証経路を調べず、個別の失敗をパスワード問題として扱っています。",
    failureImpact: "原因を特定できないまま利用者対応が増え、不要な権限変更が残るおそれがあります。",
    failureFlow: ["利用者", "AD / グループ", "AP認証", "ログイン失敗"],
    variants: {
      easy: {
        background: "移行先APで、一部の利用者だけがログインできません。旧環境では同じ利用者がログインできています。",
        users: 40, downtimeMinutes: 120, systemType: "社内申請システム",
        dependencies: ["Active Directory", "利用者グループ", "APサーバー"],
        details: ["失敗する利用者: 特定の部署", "旧AP: ログイン成功", "新AP: ログイン失敗"],
        question: "原因調査の最初の一歩として適切なのはどれですか？",
      },
      normal: {
        background: "新APへの切替後、利用者ログインは成功しますが、夜間バッチがDBへ接続できません。人のアカウントでは接続テスト済みです。",
        users: 800, downtimeMinutes: 90, systemType: "受注管理・夜間バッチ",
        dependencies: ["Active Directory", "サービスアカウント", "タスクスケジューラ", "Oracle DB"],
        details: ["利用者ログイン: 成功", "バッチ実行ユーザー: svc_batch", "DB接続失敗: バッチのみ"],
        question: "次に確認すべき認証関連の設定は何ですか？",
      },
      hard: {
        background: "本番切替後、外部委託先の利用者と特定APIの双方で認証失敗が発生しています。GPO適用結果が旧新で異なるとの報告があります。",
        users: 3200, downtimeMinutes: 25, systemType: "複数ドメイン連携の業務基盤",
        dependencies: ["複数Active Directoryドメイン", "信頼関係", "GPO", "APIサービスアカウント"],
        details: ["外部利用者: 一部ログイン不可", "API: 401応答", "GPO差分: 未調査"],
        question: "広範囲な変更を避けて原因を特定するため、どの順で切り分けますか？",
      },
    },
  },
  {
    id: "ad-trust",
    title: "ドメイン依存の見落とし",
    category: "Active Directory",
    dimension: "riskJudge",
    choices: [
      "ドメイン・DNS・時刻同期・信頼関係を確認し、利用者とサービスアカウントの認証を別々にテストする",
      "ADサーバーを新環境へコピーすれば認証は自動で引き継がれると判断する",
      "アプリケーションの接続先をIPアドレスへ変更して認証を回避する",
      "ユーザー数が少ないため認証試験を省略する",
    ],
    correctAnswers: [0],
    explanation: "AD依存はユーザー認証だけではありません。名前解決、時刻、ドメイン信頼、グループポリシー、実行アカウントの権限が関係します。",
    consequenceGood: "認証に必要な外部依存を切替前に確認し、利用者・バッチ双方の失敗を予防できます。",
    consequenceBad: "移行先でドメイン認証やサービスアカウントが機能せず、業務開始後に障害として発覚します。",
    seniorReview: "「ADがある」だけでは設計情報になりません。どの認証主体が、どの経路で、何に認証するかを整理しましょう。",
    failureTitle: "サービスアカウントがドメイン認証できない",
    failureDescription: "新環境からドメインコントローラーへ到達できず、タスクやAPIの認証が失敗します。",
    failureImpact: "ログイン・バッチ・連携処理が同時に影響を受ける可能性があります。",
    failureFlow: ["AP / バッチ", "DNS・時刻・信頼関係", "AD", "認証失敗"],
    variants: {
      easy: {
        background: "移行先サーバーのドメイン参加は完了したと報告されています。利用者ログインとバッチの確認計画はまだありません。",
        users: 150, downtimeMinutes: 180, systemType: "部門ポータル",
        dependencies: ["ADドメイン", "DNS", "APサーバー"],
        details: ["ドメイン参加: 完了報告のみ", "利用者認証テスト: 未実施"],
        question: "移行後の認証確認で、利用者操作以外に何を試験しますか？",
      },
      normal: {
        background: "サーバーはドメイン参加済みですが、切替後の夜間処理は異なるサービスアカウントで実行されます。時刻同期の設定資料がありません。",
        users: 1400, downtimeMinutes: 75, systemType: "経費精算と夜間連携",
        dependencies: ["ADドメイン", "DNS", "NTP", "サービスアカウント"],
        details: ["タスク実行ユーザー: EXAMPLE\\svc_batch", "NTP設定: 記録なし"],
        question: "切替前に追加確認すべき依存関係は何ですか？",
      },
      hard: {
        background: "複数ドメイン間で認証するシステムです。切替先サブネットは変更され、ファイアウォール申請と信頼関係の疎通確認が未完了です。",
        users: 5000, downtimeMinutes: 30, systemType: "グループ会社共通基盤",
        dependencies: ["複数ADドメイン", "ドメイン信頼", "DNSフォワーダー", "Firewall"],
        details: ["サブネット: 変更", "信頼関係試験: 未実施", "停止枠: 30分"],
        question: "切替Goを判断する前に、何を必須条件として確認しますか？",
      },
    },
  },
  {
    id: "oracle-window",
    title: "Oracle移行方式と停止枠",
    category: "Oracle",
    dimension: "technicalJudge",
    choices: [
      "更新量・停止可能時間・互換性をDBAと評価し、停止枠に合う同期方式と切戻し条件を決める",
      "利用者数が多いので、無条件にData Pumpを選択する",
      "移行時間を短くするため、バックアップなしで本番DBへ直接コピーする",
      "停止可能時間を確認せず、最も新しいOracleバージョンを先に導入する",
    ],
    correctAnswers: [0],
    explanation: "移行方式は利用者数だけでは決まりません。データ量・更新量・停止枠・互換性・運用体制を評価し、実測リハーサルで実現性を確認します。",
    consequenceGood: "業務制約に合った方式を選び、移行時間とデータ整合性のリスクを事前に評価できます。",
    consequenceBad: "停止枠内に移行が終わらない、または移行後に互換性・性能問題が発覚します。",
    seniorReview: "方式選定では「製品名」より、許容停止時間とデータ更新をどのように追随させるかを説明できることが重要です。",
    failureTitle: "選んだ移行方式が停止枠に収まらない",
    failureDescription: "移行データ量や更新停止後の所要時間を実測せず、本番作業に着手しています。",
    failureImpact: "業務再開が遅れ、データ整合性を保てないまま切替・切戻し判断を迫られます。",
    failureFlow: ["業務更新停止", "Oracle移行", "停止枠超過", "再開・切戻し判断"],
    variants: {
      easy: {
        background: "小規模なOracle DBを更改します。週末に長めの停止時間を確保できますが、移行方式はまだ決まっていません。",
        users: 60, downtimeMinutes: 360, systemType: "小規模な部門業務システム",
        databases: ["Oracle 11g → Oracle 19c"], dependencies: ["APサーバー", "Oracle Listener"],
        details: ["データ量: 18GB", "更新停止可能時間: 最大6時間", "互換性試験: 予定あり"],
        question: "方式を決める前に揃えるべき情報は何ですか？",
      },
      normal: {
        background: "複数TBのOracle DBを移行します。停止枠は90分で、業務中も更新が続きます。Data Pumpのリハーサル時間は未確保です。",
        users: 1800, downtimeMinutes: 90, systemType: "24時間運用の販売管理",
        databases: ["Oracle 11g → Oracle 19c"], dependencies: ["APサーバー", "Oracle Listener", "夜間バッチ"],
        details: ["データ量: 2.4TB", "日中更新: 継続", "リハーサル実測: なし"],
        question: "この制約下で最も適切な方式選定アプローチは何ですか？",
      },
      hard: {
        background: "停止上限15分のオンライン決済DBです。更新量が多く、旧新Oracleの機能差と切戻し後のデータ同期が未評価です。",
        users: 5000, downtimeMinutes: 15, systemType: "24時間運用の決済システム",
        databases: ["Oracle 12c → Oracle 19c"], dependencies: ["APクラスタ", "Oracle RAC", "監査ログ", "決済連携"],
        details: ["更新量: 高", "切替停止上限: 15分", "切戻し時の新DB更新反映: 未設計"],
        question: "方式を選ぶ前に、どのリスクをDBAと最優先で検証しますか？",
      },
    },
  },
  {
    id: "oracle-compatibility",
    title: "Oracleの互換性を見落とさない",
    category: "Oracle",
    dimension: "technicalJudge",
    choices: [
      "アプリ・ドライバー・文字コード・初期化パラメーター・SQL/PLSQLを棚卸しし、対象DBで回帰試験する",
      "Oracleのメジャーバージョンが上がるだけなので、接続確認だけで本番切替する",
      "移行先の全テーブルを手作業で作り直し、データだけコピーする",
      "問題が出てからアプリ担当へ調査を依頼する",
    ],
    correctAnswers: [0],
    explanation: "DB移行はデータのコピーだけではありません。クライアントドライバー、SQL挙動、文字コード、オブジェクト、性能、接続先サービス名を確認します。",
    consequenceGood: "アプリケーションとDBの組み合わせを本番前に検証し、移行後に発覚する互換性問題を減らせます。",
    consequenceBad: "移行後にSQLエラー、文字化け、性能劣化などが発生し、業務影響の中で原因調査を行うことになります。",
    seniorReview: "現行が動いている事実は、新しいDBバージョンでも動く証明にはなりません。試験範囲と合格条件を合意しましょう。",
    failureTitle: "移行後にアプリケーションのSQLが失敗する",
    failureDescription: "バージョン差やドライバー差を確認せず、本番DBを切り替えました。",
    failureImpact: "主要画面やバッチの処理が停止し、切戻しが必要になる可能性があります。",
    failureFlow: ["AP / JDBCドライバー", "互換性差分", "Oracle 19c", "SQL・処理エラー"],
    variants: {
      easy: {
        background: "Oracle 11gから19cへ更新します。アプリケーションはJava 8で動作し、JDBCドライバーのバージョンが不明です。",
        users: 300, downtimeMinutes: 240, systemType: "部門向けJava業務システム",
        databases: ["Oracle 11g → Oracle 19c"], dependencies: ["Java 8", "JDBC", "APサーバー"],
        details: ["JDBCドライバー: 未確認", "文字コード: 旧設計書に記載"],
        question: "アプリケーションの接続試験前に確認すべきことは何ですか？",
      },
      normal: {
        background: "Oracle 19cへの移行リハーサルでは接続に成功しましたが、帳票・夜間バッチの業務シナリオは実行していません。",
        users: 1600, downtimeMinutes: 120, systemType: "販売・帳票・夜間バッチシステム",
        databases: ["Oracle 12c → Oracle 19c"], dependencies: ["JDBC", "帳票", "PL/SQL", "夜間バッチ"],
        details: ["単純接続: 成功", "業務SQL・帳票試験: 未実施"],
        question: "切替前の合格判定として何を追加しますか？",
      },
      hard: {
        background: "本番相当データの移行後、一部SQLの実行計画が変わる可能性が指摘されました。停止枠は短く、事前性能試験は限定的です。",
        users: 4200, downtimeMinutes: 30, systemType: "大量データの基幹分析・受注基盤",
        databases: ["Oracle 12c → Oracle 19c"], dependencies: ["統計情報", "SQL実行計画", "バッチ", "監視"],
        details: ["主要SQLの性能比較: 未完了", "データ量: 本番相当", "切替後の性能判定値: 未合意"],
        question: "Go判定に必要な性能リスクの扱いはどれですか？",
      },
    },
  },
  {
    id: "datapump-final-sync",
    title: "Data Pump後に増えた更新データ",
    category: "Data Pump",
    dimension: "technicalJudge",
    choices: [
      "初回移行後の更新を洗い出し、更新停止後に合意した最終同期を行って件数・整合性を照合する",
      "初回エクスポートのログが正常なら、その時点以降の更新も移行済みとみなす",
      "切替後に旧DBと新DBを同時に書込み可能にする",
      "件数確認を省略してDNSだけ切り替える",
    ],
    correctAnswers: [0],
    explanation: "Data Pumpのエクスポートは実行時点のデータを移行します。移行中も業務更新が続いた場合、その差分をどう反映するかを設計しなければなりません。",
    consequenceGood: "更新を止めた後の最終同期と照合を行い、切替点のデータ欠損リスクを抑えられます。",
    consequenceBad: "初回エクスポート後に登録された注文・履歴が新DBへ移行されず、旧新でデータが食い違います。",
    seniorReview: "「Data Pumpが成功したか」だけでなく、どの時点までのデータが含まれ、残りをどう同期するかを確認しましょう。",
    failureTitle: "初回エクスポート後の更新が新DBにない",
    failureDescription: "初回移行中も業務更新を許可し、切替前の差分同期を行っていません。",
    failureImpact: "注文や業務履歴が欠落し、手作業での突合や切戻しが必要になります。",
    failureFlow: ["初回Data Pump", "業務更新が継続", "差分未反映", "新旧DBの不整合"],
    variants: {
      easy: {
        background: "夜間停止中にData Pumpで小規模DBを移行します。エクスポート後に何件かテスト更新が入ったと聞きました。",
        users: 90, downtimeMinutes: 180, systemType: "部門在庫管理",
        databases: ["Oracle 11g → Oracle 19c"], dependencies: ["業務更新停止", "Data Pump", "件数照合"],
        details: ["初回Export: 成功", "Export後の更新: 数件あり"],
        question: "切替前に実施するデータ作業は何ですか？",
      },
      normal: {
        background: "業務更新を停止して初回Importが完了しました。移行前後の行数は確認しましたが、最終同期と重要データの比較は未実施です。",
        users: 1300, downtimeMinutes: 60, systemType: "受発注・請求システム",
        databases: ["Oracle 12c → Oracle 19c"], dependencies: ["Data Pump", "更新停止", "業務担当者"],
        details: ["Export/Import: 成功", "行数の概算: 一致", "重要テーブル照合: 未実施"],
        question: "切替Goの前に不足している確認は何ですか？",
      },
      hard: {
        background: "オンライン更新を止めずに初回Data Pumpを実行しました。切替枠は短く、更新量のピークとデータ整合性の合格条件が不明です。",
        users: 4800, downtimeMinutes: 20, systemType: "24時間運用の受注・決済基盤",
        databases: ["Oracle 12c → Oracle 19c"], dependencies: ["Data Pump", "差分同期", "決済API", "監査ログ"],
        details: ["初回Import: 完了", "更新差分: 未計測", "二重登録検知: 未設計"],
        question: "短い停止枠で安全に切り替えるために、先に確立すべきことは何ですか？",
      },
    },
  },
  {
    id: "datapump-validation",
    title: "Import完了後の検証不足",
    category: "Data Pump",
    dimension: "riskJudge",
    choices: [
      "Importログ・オブジェクト状態・重要テーブル件数・代表業務処理を移行前後で照合する",
      "Importコマンドが終了コード0なら、業務データも完全に正しいと判断する",
      "新DBをすぐ本番化し、利用者からの問い合わせで漏れを確認する",
      "すべての警告を無視して切替する",
    ],
    correctAnswers: [0],
    explanation: "Import処理の完了と、アプリケーションが期待どおり利用できることは異なります。オブジェクト、権限、データ、業務処理を分けて確認します。",
    consequenceGood: "移行ログの警告や不完全なオブジェクトを本番切替前に検出できます。",
    consequenceBad: "必要な表・権限・オブジェクトの不備が本番利用時まで発見されず、業務処理が失敗します。",
    seniorReview: "確認対象・担当者・合格値を事前に決め、単なる「Import成功」を業務完了と混同しないでください。",
    failureTitle: "移行先に無効オブジェクトや欠落データが残る",
    failureDescription: "Data Pumpの処理結果だけを確認し、重要オブジェクトと業務シナリオを照合していません。",
    failureImpact: "ログインはできても、登録・検索・帳票など一部業務が失敗する可能性があります。",
    failureFlow: ["Data Pump Import", "警告・無効オブジェクト", "未検証で切替", "業務処理失敗"],
    variants: {
      easy: {
        background: "Importは完了しましたが、受注登録で使うPL/SQLパッケージがINVALIDのままです。開発担当は「画面にログインできたので切替可能」と言っています。",
        users: 100, downtimeMinutes: 180, systemType: "小規模な顧客台帳",
        databases: ["Oracle 11g → Oracle 19c"], dependencies: ["Importログ", "Schema", "代表業務処理"],
        details: ["受注登録パッケージ: INVALID", "ログイン: 成功", "業務処理の再試験: 未実施"],
        question: "ログイン成功だけでは判断できません。受注業務への影響を評価する次の一手は？",
        choices: [
          { text: "パッケージの依存先とコンパイルエラーを調べ、修正後に受注登録を業務担当と再試験する", benefit: "不正状態の原因と実業務への影響を直接確認できる", cost: "開発・DBA・業務担当の調整が必要で、解決しない場合は停止枠を使う" },
          { text: "受注機能だけを一時停止して切替し、担当者と期限を決めた上で後続修正する", benefit: "他機能を使える状態で切替でき、重大障害の影響を局所化できる", cost: "利用者の業務制限と暫定運用の承認が必要になる" },
          { text: "切替を保留して依存する全PL/SQLを棚卸しし、修復・回帰試験の時間を確保する", benefit: "関連オブジェクトの連鎖影響まで調べてから判断できる", cost: "小規模案件には過剰となり、利用者への日程再調整が発生する" },
          { text: "オブジェクトを再コンパイルし、エラーが残る場合は旧DBへ戻す条件を合意して限定切替する", benefit: "比較的短時間で状態を改善でき、失敗時の判断条件も準備できる", cost: "再コンパイルだけでは業務動作を証明できず、限定切替にも監視が要る" },
        ],
        fitScores: [3, 2, 1, 2],
        explanation: "Importの終了状態と各オブジェクトの有効状態は別です。INVALIDの原因・依存する処理・実行権限を確認し、受注登録など代表業務で結果を検証します。",
        seniorReview: "この案件は小規模で停止枠に余裕があります。無効オブジェクトが受注登録に直結するため、ログイン試験だけでGoにせず、修正後の業務確認を判定条件にしましょう。",
      },
      normal: {
        background: "移行前後のテーブル件数は一致しています。一方、権限・シーケンス・無効PL/SQLの確認担当が決まっていません。",
        users: 1700, downtimeMinutes: 75, systemType: "販売管理・帳票",
        databases: ["Oracle 12c → Oracle 19c"], dependencies: ["Schema権限", "Sequence", "PL/SQL", "帳票"],
        details: ["主要表の件数: 一致", "シーケンス値・権限: 未確認"],
        question: "データ件数以外で、切替前に担当と合格条件を決める対象は何ですか？",
      },
      hard: {
        background: "数十億行の履歴表で件数照合に時間がかかります。停止枠は短く、照合完了前に切替を求められています。",
        users: 5000, downtimeMinutes: 15, systemType: "大規模な監査・取引履歴基盤",
        databases: ["Oracle 19c → Oracle 19c"], dependencies: ["パーティション表", "並列Export/Import", "業務集計", "監査"],
        details: ["全件照合時間: 4時間", "停止枠: 15分", "代替サンプリング条件: 未合意"],
        question: "確認時間の制約を解消し、証跡を保つ方法として適切なのはどれですか？",
      },
    },
  },
  {
    id: "jdbc-endpoint",
    title: "JDBCが旧DBを指したまま",
    category: "JDBC",
    dimension: "technicalJudge",
    choices: [
      "新APのJDBC接続先を移行先DBに合わせて保存し、接続・業務更新先を確認する",
      "DNSのAレコードを変えればJDBCのDB接続先も自動で新DBへ変わると考える",
      "新旧DBの両方へ接続する設定にし、どちらに登録されてもよいことにする",
      "jdbc.propertiesをコピーしたので接続先の確認は不要とする",
    ],
    correctAnswers: [0],
    explanation: "JDBCはAPアプリケーションからDBへ接続する設定です。Web用DNS名の切替と、JDBCのDBホスト・ポート・サービス名の変更は別の作業です。",
    consequenceGood: "新APが意図したOracleサービスへ接続し、切替後の業務データが正しいDBに記録されます。",
    consequenceBad: "利用者は新APへ到達していても、更新が旧DBへ登録されるなど、データ不整合が起こります。",
    seniorReview: "設定ファイルを受け取った状態と、移行先向けに値を直して保存・検証した状態を区別しましょう。",
    failureTitle: "新APが旧DBへ書き込み続ける",
    failureDescription: "DNSを切り替えましたが、JDBC URLは旧DBのホスト名を参照しています。",
    failureImpact: "新旧DBへデータが分かれて登録され、切戻しやデータ統合が必要になります。",
    failureFlow: ["利用者", "新AP", "旧DBを指すJDBC", "新旧データの分散"],
    variants: {
      easy: {
        background: "新APへ設定ファイルをコピーしました。中身は旧APの接続設定をそのまま引き継いでいます。",
        users: 100, downtimeMinutes: 120, systemType: "社内Java Webアプリ",
        databases: ["旧DB: DBSV01", "移行先DB: DBSV02"], dependencies: ["jdbc.properties", "Resin", "Oracle Listener"],
        details: ["JDBC URL: DBSV01:1521:ORCL", "新DBサービス: DBSV02:1521:ORCL"],
        question: "本番DNSを切り替える前に新APで行う作業は何ですか？",
      },
      normal: {
        background: "JDBC接続テストは成功しましたが、接続先を表示する運用手順と、新DBへの書込み確認の証跡がありません。",
        users: 1000, downtimeMinutes: 60, systemType: "受注管理Javaアプリ",
        databases: ["Oracle 12c → Oracle 19c"], dependencies: ["JDBC URL", "Wallet/資格情報", "Oracle Listener"],
        details: ["TCP疎通: 成功", "接続DBのサービス名: 未記録", "試験データ書込み: 未確認"],
        question: "接続先の取り違えを防ぐために、何を追加確認しますか？",
      },
      hard: {
        background: "同じFQDNが環境ごとに異なるDBを指す設計です。新APの一部だけ旧接続先が残る可能性があり、複数ノード構成です。",
        users: 4200, downtimeMinutes: 20, systemType: "APクラスタを持つ基幹システム",
        databases: ["旧Oracle RAC", "新Oracle RAC"], dependencies: ["複数APノード", "JDBC接続プール", "DNS", "Oracleサービス名"],
        details: ["APノード数: 4", "設定配布差分: 未確認", "接続プール再生成: 手順なし"],
        question: "一部ノードだけ旧DBに接続する事態を防ぐ確認はどれですか？",
      },
    },
  },
  {
    id: "jdbc-secret",
    title: "接続設定と資格情報の安全な移行",
    category: "JDBC",
    dimension: "riskJudge",
    choices: [
      "接続先・認証情報の保管方式・権限を環境ごとに確認し、秘密情報を安全に設定して接続試験する",
      "本番DBのパスワードをチャットに貼り、全員で設定を確認する",
      "接続エラーを避けるため、旧環境の資格情報を期限なく共有する",
      "JDBC設定にパスワードが見えなければ認証情報は不要と判断する",
    ],
    correctAnswers: [0],
    explanation: "接続設定には接続先だけでなく認証情報とその保管・更新手順が関係します。秘密情報を不用意に共有せず、必要な権限で実接続を検証します。",
    consequenceGood: "資格情報を保護しながら、移行先接続の可否と運用可能性を確認できます。",
    consequenceBad: "認証情報が漏えいするか、切替後に資格情報の不一致でアプリがDB接続できなくなります。",
    seniorReview: "接続成功だけでなく、誰が秘密情報を設定し、どこでローテーションし、どう監査するかも設計対象です。",
    failureTitle: "移行先で認証に失敗、または資格情報が漏れる",
    failureDescription: "設定ファイルのコピー時に環境別の資格情報とアクセス権を確認していません。",
    failureImpact: "切替後の接続障害や、認証情報の不適切な共有につながります。",
    failureFlow: ["新AP", "接続設定・秘密情報", "Oracle認証", "接続失敗 / 漏えい"],
    variants: {
      easy: {
        background: "開発環境でJDBC接続が成功しました。本番環境の資格情報は別管理ですが、設定担当者が未定です。",
        users: 90, downtimeMinutes: 180, systemType: "部門向け業務アプリ",
        databases: ["開発Oracle", "本番Oracle"], dependencies: ["JDBC", "資格情報管理", "DB権限"],
        details: ["開発接続: 成功", "本番接続設定担当: 未定"],
        question: "本番切替前に誰が何を確認すべきですか？",
      },
      normal: {
        background: "DBAがパスワードを変更しました。新APの設定更新担当と、サービス再起動後の確認方法が作業計画にありません。",
        users: 1500, downtimeMinutes: 60, systemType: "勤怠・給与連携",
        databases: ["Oracle 19c"], dependencies: ["JDBC", "秘密情報管理", "Resinサービス"],
        details: ["DBパスワード変更: 実施", "AP反映・再接続確認: 未割当"],
        question: "切替後の接続障害を防ぐために、計画へ追加すべき作業は何ですか？",
      },
      hard: {
        background: "複数APノードに接続設定を配布します。監査要件では、秘密情報の閲覧者制限と変更履歴が必要ですが、旧設定のコピー案が出ています。",
        users: 4000, downtimeMinutes: 25, systemType: "金融系の顧客管理サービス",
        databases: ["Oracle 19c RAC"], dependencies: ["複数APノード", "秘密情報管理", "監査ログ", "JDBC"],
        details: ["資格情報の保管方式: 監査対象", "設定ファイル配布差分: 未管理"],
        question: "監査要件と可用性を両立させる移行方針はどれですか？",
      },
    },
  },
  {
    id: "user-notice",
    title: "利用者に伝わらない停止案内",
    category: "利用者周知",
    dimension: "communicationJudge",
    choices: [
      "対象業務・利用者・日時・停止影響・事前準備・問い合わせ先を明示し、適切な経路で期限をもって周知する",
      "「サーバー移行を実施します」とだけ社内チャットへ投稿する",
      "停止時間が短いので、作業完了後に利用者へ知らせる",
      "技術担当者間で合意済みなら利用部門への連絡は不要とする",
    ],
    correctAnswers: [0],
    explanation: "周知は技術作業の告知ではなく、利用者が業務影響を理解し必要な準備をできるようにするものです。対象・時間・影響・連絡先・変更通知を具体化します。",
    consequenceGood: "利用者が作業時間と影響を把握し、問い合わせ窓口や代替手順を準備できます。",
    consequenceBad: "作業中の利用やデータ入力が続き、問い合わせや未保存データの損失が発生します。",
    seniorReview: "周知文を送った事実だけで完了にせず、対象範囲・送信時期・必要な確認先を記録しましょう。",
    failureTitle: "利用者が停止を知らず業務を継続する",
    failureDescription: "案内に対象業務・停止開始時刻・問い合わせ先がなく、利用者が準備できていません。",
    failureImpact: "作業中の入力や問合せが増え、停止時間を守れなくなる可能性があります。",
    failureFlow: ["利用者", "周知不足", "作業中に業務利用", "問合せ・データ損失"],
    variants: {
      easy: {
        background: "小規模部署のシステムを週末に2時間停止します。案内文の草案は「サーバー移行を実施します」の一文だけです。",
        users: 70, downtimeMinutes: 120, systemType: "部門申請システム",
        dependencies: ["利用部門", "メール周知", "問合せ窓口"],
        details: ["停止予定: 土曜22:00〜24:00", "対象業務: 未記載"],
        question: "利用者に追加で伝えるべき情報は何ですか？",
      },
      normal: {
        background: "1200名が使う受発注システムを夜間停止します。営業拠点は海外にもあり、案内文の対象と時間帯が曖昧です。",
        users: 1200, downtimeMinutes: 90, systemType: "複数拠点の受発注システム",
        dependencies: ["国内外の営業拠点", "メール", "ヘルプデスク"],
        details: ["予定: 22:00〜23:30 JST", "停止後の再開連絡: 未定"],
        question: "誤解を減らす周知計画として何を決めますか？",
      },
      hard: {
        background: "決済業務を含むシステムの停止案内が必要です。停止枠は短く、業務部門は締め処理後の利用可否と未処理データの扱いを懸念しています。",
        users: 5000, downtimeMinutes: 30, systemType: "顧客向け決済・請求基盤",
        dependencies: ["顧客", "業務部門", "コールセンター", "決済連携"],
        details: ["作業時間帯: 23:30〜24:00", "未処理取引の扱い: 未合意", "障害時連絡先: 要整理"],
        question: "周知を承認に出す前に、業務部門と合意すべき内容は何ですか？",
      },
    },
  },
  {
    id: "user-audience",
    title: "周知対象と完了確認の抜け",
    category: "利用者周知",
    dimension: "communicationJudge",
    choices: [
      "対象者一覧・各連絡経路・送信期限・未達時の追跡方法を決め、送信と周知完了を証跡化する",
      "全社メーリングリストへ一度送信したので対象確認は不要とする",
      "利用者数が多いので、周知は切替後に行う",
      "メールを送れば読まれたことも確認済みとみなす",
    ],
    correctAnswers: [0],
    explanation: "利用者周知には、対象者の網羅性・経路・タイミング・確認が必要です。送信済みと周知が届いたことは同じではありません。",
    consequenceGood: "重要利用者や外部委託先への伝達漏れを発見し、作業前に対応できます。",
    consequenceBad: "一部の利用者が停止を知らず、障害・問い合わせ・作業延期につながります。",
    seniorReview: "送信記録だけでなく、対象者が誰で、未達をどう追うかを残すのが実務です。",
    failureTitle: "重要利用者が停止案内を受け取っていない",
    failureDescription: "全社メールには載っていない外部利用者と夜間運用担当が対象から漏れています。",
    failureImpact: "作業中の連携実行や利用者問い合わせが発生し、切替計画が乱れます。",
    failureFlow: ["利用者一覧の漏れ", "周知未達", "停止中のアクセス", "作業延期"],
    variants: {
      easy: {
        background: "部署内へメールを送る予定です。異動者と長期休暇中の担当者が利用者一覧に含まれるか分かりません。",
        users: 110, downtimeMinutes: 120, systemType: "社内ワークフロー",
        dependencies: ["利用者一覧", "部門責任者", "メール"],
        details: ["送信予定: 1回", "未達確認: なし"],
        question: "案内の到達性を確認するために追加すべきことは何ですか？",
      },
      normal: {
        background: "外部取引先と夜間運用担当も利用するシステムです。社内メールの配信先には外部利用者が含まれていません。",
        users: 2200, downtimeMinutes: 90, systemType: "取引先連携ポータル",
        dependencies: ["外部取引先", "夜間運用", "メール", "サポート窓口"],
        details: ["外部利用者: 400名", "社内配信リストのみ準備済み"],
        question: "周知漏れを防ぐため、対象整理で最初に行うことは何ですか？",
      },
      hard: {
        background: "規制対象サービスの移行です。利用者一覧には個人情報があり、周知記録は監査証跡として保管しなければなりません。",
        users: 8000, downtimeMinutes: 45, systemType: "規制対象の顧客ポータル",
        dependencies: ["顧客管理", "個人情報保護", "監査", "複数通知経路"],
        details: ["監査要件: 周知履歴の保存", "配信確認: 未設計"],
        question: "監査性と個人情報保護を両立させる対応はどれですか？",
      },
    },
  },
  {
    id: "go-no-go-gates",
    title: "未完了の確認項目とGo/No-Go",
    category: "Go/No-Go",
    dimension: "riskJudge",
    choices: [
      "必須条件と未完了項目を確認し、影響・期限・代替策を評価して責任者がNo-Goを含め判断する",
      "予定時刻になったので未確認項目があってもGoにする",
      "作業担当者が各自の範囲だけ確認し、責任者の判定は省略する",
      "不具合は切替後に直せるので、試験結果を待たずに進める",
    ],
    correctAnswers: [0],
    explanation: "Go/No-Goは時刻ではなく、合意した必須条件・残リスク・業務影響・切戻し可能性に基づいて決めます。No-Goは適切な判断になり得ます。",
    consequenceGood: "未完了リスクを可視化し、業務責任者を含めた根拠ある判断ができます。",
    consequenceBad: "未解決の重大障害を本番へ持ち込み、停止枠内に復旧できなくなる可能性があります。",
    seniorReview: "Goを出す条件だけでなく、判断者・判定時刻・No-Go時の次の行動も事前に合意しましょう。",
    failureTitle: "未完了条件を残したまま本番切替する",
    failureDescription: "試験・データ照合・切戻し準備の未完了を確認せず、予定時刻を優先してGoにしました。",
    failureImpact: "障害時に復旧策がなく、利用者影響と停止時間が拡大します。",
    failureFlow: ["Go判定", "未完了の必須確認", "本番切替", "重大障害"],
    variants: {
      easy: {
        background: "新APの疎通試験は成功しましたが、業務担当による画面確認はまだです。切替作業の開始時刻が近づいています。",
        users: 90, downtimeMinutes: 180, systemType: "部門内ワークフロー",
        dependencies: ["AP疎通", "業務確認", "切替責任者"],
        details: ["HTTP疎通: 成功", "業務シナリオ: 未実施"],
        question: "開始判定で、どの対応が最も適切ですか？",
      },
      normal: {
        background: "性能試験は基準内ですが、バッチ結果と利用者周知の確認が未完了です。責任者は「残りは後で確認」と提案しています。",
        users: 1600, downtimeMinutes: 75, systemType: "受注・夜間バッチシステム",
        dependencies: ["性能試験", "バッチ", "利用者周知", "Go/No-Go会議"],
        details: ["性能: 合格", "バッチ: 未確認", "周知完了: 未確認"],
        question: "Go判定に含めるべき未完了項目の扱いはどれですか？",
      },
      hard: {
        background: "重大な脆弱性対応とDB差分同期の確認が未完了です。経営層から予定どおりの切替を求められていますが、代替策は文書化されていません。",
        users: 6000, downtimeMinutes: 20, systemType: "重要顧客向け24時間サービス",
        dependencies: ["セキュリティ承認", "DB差分同期", "業務責任者", "切戻し計画"],
        details: ["重大脆弱性: 未承認", "差分同期リハーサル: 未完了", "業務影響評価: なし"],
        question: "責任者として取るべき判断と説明はどれですか？",
      },
    },
  },
  {
    id: "go-no-go-evidence",
    title: "根拠のない切替承認",
    category: "Go/No-Go",
    dimension: "communicationJudge",
    choices: [
      "各担当の証跡と業務側の合格確認を集め、残リスク・判断者・判断時刻を記録して関係者へ共有する",
      "会議参加者が口頭で問題ないと言ったので記録を残さない",
      "技術担当者の試験結果だけで業務部門の承認も済んだとみなす",
      "承認者不在でも作業責任者の判断でGoにする",
    ],
    correctAnswers: [0],
    explanation: "切替判断は技術試験だけでは完結しません。業務受入れ、未解決リスク、判断者、結果の記録と共有が必要です。",
    consequenceGood: "関係者が同じ前提で作業を開始し、問題時に判断経緯を追跡できます。",
    consequenceBad: "担当間で合意内容が食い違い、障害時に誰が何を承認したか分からなくなります。",
    seniorReview: "判断の根拠と承認者を記録することは、責任追及のためだけでなく、適切な次の判断を可能にします。",
    failureTitle: "担当者ごとにGo条件の理解が異なる",
    failureDescription: "口頭の「大丈夫」を正式な合意とみなし、業務受入れと承認記録がありません。",
    failureImpact: "作業続行・中断・切戻しの判断が遅れ、利用者への説明も一貫しません。",
    failureFlow: ["技術試験", "業務承認なし", "判断記録なし", "対応が遅延"],
    variants: {
      easy: {
        background: "関係者会議では「問題なさそう」と話されましたが、切替チェックリストと承認者の記録がありません。",
        users: 100, downtimeMinutes: 120, systemType: "部門ポータル",
        dependencies: ["運用担当", "業務責任者", "切替チェックリスト"],
        details: ["技術試験: 一部完了", "承認記録: なし"],
        question: "切替開始前に残すべき記録は何ですか？",
      },
      normal: {
        background: "技術試験は完了しましたが、業務部門は帳票結果の受入れ確認をしていません。議事録には結論だけが記載されています。",
        users: 1400, downtimeMinutes: 60, systemType: "経理・帳票システム",
        dependencies: ["技術試験", "業務受入れ", "議事録", "承認者"],
        details: ["帳票確認: 未承認", "会議記録: 判断根拠なし"],
        question: "切替判定を成立させるために必要なコミュニケーションはどれですか？",
      },
      hard: {
        background: "複数部門が参加する切替会議で、DBAはGo、業務責任者は未確認のためNo-Goと発言しました。決定者と議事録担当が不明です。",
        users: 5200, downtimeMinutes: 25, systemType: "複数部門共通の顧客基盤",
        dependencies: ["PM", "DBA", "業務責任者", "運用責任者"],
        details: ["部門間の判定: 不一致", "最終決定者: 不明"],
        question: "混乱を防ぐため、PMが次に行うべきことは何ですか？",
      },
    },
  },
  {
    id: "rollback-window",
    title: "切戻し可能時間を超えそうな障害",
    category: "切戻し",
    dimension: "rollbackJudge",
    choices: [
      "事前合意した判定期限・影響閾値と復旧見込みを照らし、責任者へ即時共有して継続か切戻しかを決める",
      "停止時間が延びても原因が完全に分かるまで本番で修正を続ける",
      "担当者一人の判断でDNSだけ戻し、データ更新状態は後で確認する",
      "利用者へ知らせず、障害を記録しないまま再起動を繰り返す",
    ],
    correctAnswers: [0],
    explanation: "切戻し判断は原因究明と並行して、利用者影響・時間・データ状態・復旧見込みを評価し、合意済みの条件で行います。",
    consequenceGood: "判断期限内に被害を抑える選択ができ、作業継続・切戻し双方の責任と影響を共有できます。",
    consequenceBad: "切戻し可能な時間を逃し、データ不整合を抱えたまま利用者停止が長引きます。",
    seniorReview: "切戻しはDNSを戻すだけではありません。新環境に入った更新をどう扱うかまで計画してください。",
    failureTitle: "復旧判断が遅れ切戻し期限を超える",
    failureDescription: "障害対応に集中するあまり、利用者影響と切戻し可能時間を確認していません。",
    failureImpact: "長時間停止や、旧環境へ戻した後のデータ欠損・二重登録が発生します。",
    failureFlow: ["新環境で障害", "判断期限を超過", "切戻し困難", "停止時間が拡大"],
    variants: {
      easy: {
        background: "切替後15分でログイン成功率が70%に低下しました。認証ログには特定グループの拒否があり、計画上の切戻し判定まで残り15分です。",
        users: 180, downtimeMinutes: 90, systemType: "社内申請システム",
        dependencies: ["障害ログ", "切戻し手順", "業務責任者"],
        details: ["切替後: 15分", "ログイン成功率: 70%", "対象: 特定グループ", "切戻し判定期限: 30分"],
        question: "残り15分で影響を抑えつつ判断するため、どの対応を選びますか？",
        choices: [
          { text: "認証ログと対象グループを10分で照合し、改善しなければ責任者承認の上で切り戻す", benefit: "原因を絞る時間を確保しつつ、期限内に切戻しへ移れる", cost: "調査が長引くと判定期限を使い切るため、進行管理が必要" },
          { text: "影響を受けるグループを新APから一時除外し、他の利用者は監視下で継続する", benefit: "利用可能な利用者への影響を限定し、共通障害か個別設定かを見極められる", cost: "対象者の業務を止め、例外経路と復帰連絡を管理する必要がある" },
          { text: "直ちに業務責任者へ判定状況を共有し、停止枠延長の承認を得られなければ計画どおり切り戻す", benefit: "利用者影響と期限を踏まえ、責任者の合意を得て判断できる", cost: "延長が認められない場合は移行延期となり、再周知が必要" },
          { text: "旧APを限定的な代替経路として維持し、新APの認証を調査する間は書込み先を一本化する", benefit: "影響利用者の業務継続を図りながら原因調査できる", cost: "新旧経路の切り分けと書込み制御を誤るとデータ不整合が起きる" },
        ],
        fitScores: [3, 2, 3, 1],
        explanation: "この事象は全利用者ではなく特定グループに限定されています。残り15分でログ照合と復旧見込みを確認しつつ、延長承認・影響限定・切戻し準備を並行します。",
        seniorReview: "「原因が分かるまで調査」ではなく、判定期限・影響範囲・延長可否を基準に選びます。延長する場合も業務責任者の合意と新しい中止時刻を記録してください。",
      },
      normal: {
        background: "新APは一部利用者で動作しますが、主要業務の更新に失敗します。作業計画には切戻し条件が記載されていますが、担当者は原因調査を続けています。",
        users: 1700, downtimeMinutes: 60, systemType: "受注管理システム",
        dependencies: ["APログ", "Oracle更新状態", "切戻し責任者", "利用者周知"],
        details: ["切替後: 25分", "更新処理: 失敗", "計画の判定期限: 30分"],
        question: "切戻し期限が迫る中で最も適切な行動はどれですか？",
      },
      hard: {
        background: "本番切替後にDB更新が一部成功し、一部はタイムアウトしています。旧DBへ戻すと新DB側の成功データが失われる可能性があります。",
        users: 4800, downtimeMinutes: 20, systemType: "受発注・決済システム",
        dependencies: ["新旧Oracle", "トランザクションログ", "業務責任者", "顧客対応"],
        details: ["更新結果: 成否混在", "単純DNS切戻し: データ損失リスク", "更新停止判断: 未実施"],
        question: "データ整合性を保ちながら切戻し可否を判断するための初動は何ですか？",
      },
    },
  },
  {
    id: "rollback-data",
    title: "切戻し後のデータ整合性",
    category: "切戻し",
    dimension: "rollbackJudge",
    choices: [
      "書込みを制御し、新旧DBの更新差分を保全・照合して、DBAと業務責任者が復旧方針を決める",
      "DNSを旧APへ戻せばデータも自動で旧DBへ戻ると判断する",
      "新DBを削除してから、利用者へ切戻しを通知する",
      "旧新DBの双方で書込みを継続し、後から重複を除去する",
    ],
    correctAnswers: [0],
    explanation: "DNS切戻しは通信先を変えるだけでデータを戻しません。切替後の更新を保全し、新旧DBの差分を評価してから再開します。",
    consequenceGood: "切戻しに伴うデータ欠損や二重登録を把握し、業務側と安全な再開手順を決められます。",
    consequenceBad: "新環境で受け付けた更新が旧環境に反映されず、業務記録が失われます。",
    seniorReview: "ネットワークの切戻しとデータの切戻しは別です。書込み停止・差分保全・照合を計画へ含めましょう。",
    failureTitle: "DNSだけ戻してデータを失う",
    failureDescription: "新DBで成功した更新を保全・同期せず、通信先だけを旧環境へ戻しています。",
    failureImpact: "切替中の注文や履歴が消失または重複し、業務再開を安全に判断できません。",
    failureFlow: ["新DBへの更新", "DNSだけ切戻し", "旧DBで業務再開", "更新データの欠損"],
    variants: {
      easy: {
        background: "新APへ切替後に障害が発生しました。少数のテスト更新が新DBで成功している可能性があります。",
        users: 100, downtimeMinutes: 120, systemType: "部門在庫管理",
        databases: ["旧DB", "新DB"], dependencies: ["DNS", "APサーバー", "更新データ"],
        details: ["切替後の更新件数: 未確認"],
        question: "旧環境へ戻す前に必ず確認するデータ上の事項は何ですか？",
      },
      normal: {
        background: "30分間、新DBで受注を受け付けました。障害により旧環境へ戻す方針ですが、新環境の取引を旧DBへ反映する手順はありません。",
        users: 2000, downtimeMinutes: 60, systemType: "受注・請求システム",
        databases: ["Oracle 12c", "Oracle 19c"], dependencies: ["DNS", "新旧DB", "受注データ"],
        details: ["新DBの更新期間: 30分", "差分反映手順: なし"],
        question: "切戻し作業を始める前のデータ保護として適切なのはどれですか？",
      },
      hard: {
        background: "障害中も外部連携から更新要求が届きます。即時切戻しが必要ですが、二重処理と未確定トランザクションを避ける必要があります。",
        users: 7000, downtimeMinutes: 15, systemType: "高頻度の外部連携基盤",
        databases: ["Oracle RAC 新旧環境"], dependencies: ["外部API", "メッセージキュー", "トランザクション", "DBA"],
        details: ["流入更新: 継続中", "キュー再送制御: 未確認", "切戻し責任者: 待機中"],
        question: "データ損失や二重処理を避けるための初動は何ですか？",
      },
    },
  },
  {
    id: "certificate-private-key",
    title: "証明書を移行したのにHTTPSが失敗",
    category: "証明書",
    dimension: "technicalJudge",
    choices: [
      "有効期限・ホスト名・証明書チェーン・対応する秘密鍵・バインド設定を確認して疎通試験する",
      "証明書ファイルが存在すればHTTPSは利用できると判断する",
      "HTTPSエラーを避けるため、利用者へHTTP接続を案内する",
      "秘密鍵を全サーバー共通の公開フォルダーへコピーする",
    ],
    correctAnswers: [0],
    explanation: "サーバー証明書だけではTLS通信を確立できません。秘密鍵の対応、有効期限、名前、信頼チェーン、サービスへのバインドを確認します。",
    consequenceGood: "利用者が信頼できるHTTPS接続を、新環境で再現できます。",
    consequenceBad: "証明書警告やTLSエラーが発生し、利用者がシステムへ接続できなくなります。",
    seniorReview: "秘密鍵は機密情報です。移行手段とアクセス権を限定し、インストール後に対応関係を検証してください。",
    failureTitle: "新APに秘密鍵がなくHTTPSを確立できない",
    failureDescription: "証明書のみを移行し、対応する秘密鍵とWebサービスのバインドを確認していません。",
    failureImpact: "ブラウザー警告やHTTPS接続エラーが発生し、利用者がアクセスできません。",
    failureFlow: ["利用者", "HTTPS要求", "新APの証明書 / 秘密鍵", "TLS接続失敗"],
    variants: {
      easy: {
        background: "Web証明書を新APへコピーしました。証明書マネージャーには表示されますが、ブラウザーから警告が出ます。",
        users: 100, downtimeMinutes: 120, systemType: "社内HTTPSポータル",
        dependencies: ["SSL証明書", "秘密鍵", "IIS/Resinバインド"],
        details: ["証明書期限: 1年後", "秘密鍵アイコン: 未確認"],
        question: "HTTPSを受け付けるために確認する項目は何ですか？",
      },
      normal: {
        background: "証明書と秘密鍵はインポート済みですが、サービス再起動後に新APのHTTPSだけ失敗します。旧APは正常です。",
        users: 1600, downtimeMinutes: 60, systemType: "顧客向けHTTPS業務サイト",
        dependencies: ["SSL証明書", "秘密鍵", "証明書チェーン", "Resin"],
        details: ["証明書インポート: 完了", "新APの443番バインド: 未確認"],
        question: "証明書以外で優先して確認する設定は何ですか？",
      },
      hard: {
        background: "ホスト名変更を伴う移行です。証明書のSAN、チェーン、秘密鍵のアクセス権に加え、期限切れまでの更新計画も必要です。",
        users: 4500, downtimeMinutes: 30, systemType: "外部公開の顧客認証基盤",
        dependencies: ["SAN証明書", "中間CA", "秘密鍵権限", "ロードバランサー"],
        details: ["新ホスト名: 証明書SANと照合未実施", "更新担当: 未定"],
        question: "Go判定で確認すべき証明書関連の範囲はどれですか？",
      },
    },
  },
  {
    id: "certificate-chain",
    title: "中間証明書と期限管理",
    category: "証明書",
    dimension: "riskJudge",
    choices: [
      "クライアント視点のTLS検証で証明書チェーン・ホスト名・期限・中間証明書を確認し、更新責任者も定める",
      "サーバー上に証明書ファイルがあるため、利用者環境の検証は不要とする",
      "期限切れ後に問題が出たら証明書を手動で更新する",
      "中間証明書はブラウザーが必ず補うので構成しない",
    ],
    correctAnswers: [0],
    explanation: "証明書の信頼はサーバー側のファイルだけでなく、クライアントから見た証明書チェーンや名前、有効期間に依存します。",
    consequenceGood: "主要クライアントでのTLS信頼性を確認し、期限切れによる突発障害を予防できます。",
    consequenceBad: "一部ブラウザーや連携先だけが証明書を信頼できず、接続障害や期限切れが起こります。",
    seniorReview: "移行時の正常性だけでなく、証明書更新の責任者・通知先・期限前の確認時期も運用へ引き継ぎましょう。",
    failureTitle: "一部クライアントが証明書チェーンを信頼しない",
    failureDescription: "中間証明書が配信されず、特定クライアントのTLS検証に失敗しています。",
    failureImpact: "顧客や外部連携先だけ接続できない状態が続き、原因の再現が難しくなります。",
    failureFlow: ["クライアント", "サーバー証明書", "中間証明書欠落", "信頼エラー"],
    variants: {
      easy: {
        background: "新APの証明書は有効期限内ですが、一部端末からだけ証明書警告が表示されます。",
        users: 240, downtimeMinutes: 120, systemType: "社内ポータル",
        dependencies: ["サーバー証明書", "中間CA", "クライアント端末"],
        details: ["代表PC: 正常", "一部端末: 証明書警告"],
        question: "端末差の原因を調べるため、何を比較しますか？",
      },
      normal: {
        background: "社内ブラウザーでは正常ですが、外部API連携先からTLS検証エラーが返ります。相手側の信頼ストアを変更できません。",
        users: 800, downtimeMinutes: 75, systemType: "外部API連携サービス",
        dependencies: ["サーバー証明書", "中間CA", "外部API"],
        details: ["社内ブラウザー: 正常", "外部API: チェーンエラー"],
        question: "サーバー側で優先して確認・修正する点は何ですか？",
      },
      hard: {
        background: "証明書期限まで10日です。更新申請には複数の承認が必要ですが、担当者が異動し、更新後の切替手順もありません。",
        users: 3000, downtimeMinutes: 20, systemType: "顧客認証・外部連携基盤",
        dependencies: ["認証局", "証明書担当", "複数AP", "監査"],
        details: ["残り期限: 10日", "更新申請: 未着手", "バインド変更手順: なし"],
        question: "障害の予防と運用継続のため、直ちに行う管理対応は何ですか？",
      },
    },
  },
  {
    id: "batch-schedule",
    title: "移行先で夜間バッチが実行されない",
    category: "バッチ",
    dimension: "operationJudge",
    choices: [
      "タスクの実行時刻・タイムゾーン・実行ユーザー・権限・引数・終了コードを確認し、移行先で試験実行する",
      "タスク名が同じなので、移行先でも同じ時刻に動くとみなす",
      "運用担当が毎朝手動で実行すればよいとして原因を調べない",
      "同じタスクを複数回登録して実行漏れを防ぐ",
    ],
    correctAnswers: [0],
    explanation: "タスク移行では定義だけでなく、実行ユーザー、資格情報、権限、作業ディレクトリ、時刻、結果の監視も引き継ぎます。",
    consequenceGood: "本番スケジュール前に実行条件と出力結果を確認し、運用の空白を防げます。",
    consequenceBad: "バッチが未実行・重複実行となり、締め処理や連携データに影響します。",
    seniorReview: "タスクを登録したことと、運用条件下で一度成功したことを分けて確認しましょう。",
    failureTitle: "実行ユーザーの権限不足でバッチが失敗する",
    failureDescription: "移行先でタスク定義だけを作り、実行アカウントとアクセス権を検証していません。",
    failureImpact: "翌朝の帳票・連携ファイルが作られず、業務処理が遅れます。",
    failureFlow: ["タスクスケジューラ", "実行ユーザー権限不足", "バッチ失敗", "連携・帳票欠落"],
    variants: {
      easy: {
        background: "旧APのタスクを新APへ登録しました。タスクスケジューラでは「準備完了」と表示され、実行履歴はありません。",
        users: 100, downtimeMinutes: 180, systemType: "夜間Excel出力",
        dependencies: ["タスクスケジューラ", "サービスアカウント", "出力フォルダー"],
        details: ["実行ユーザー: EXAMPLE\\svc_batch", "手動試験: 未実施"],
        question: "本番スケジュールを有効にする前に何を試験しますか？",
      },
      normal: {
        background: "移行先でバッチは起動しますが、出力ファイルが共有フォルダーにありません。実行履歴は成功と表示されています。",
        users: 1300, downtimeMinutes: 60, systemType: "夜間CSV連携・帳票出力",
        dependencies: ["タスクスケジューラ", "共有フォルダー", "サービスアカウント", "監視"],
        details: ["タスク履歴: 成功", "出力先: UNCパス", "出力ファイル: 未確認"],
        question: "業務完了まで確認するため、次に調べるべきことは何ですか？",
      },
      hard: {
        background: "移行中の誤設定で新旧APの同一バッチが並行実行される可能性があります。バッチは外部へ請求データを送信します。",
        users: 6000, downtimeMinutes: 30, systemType: "請求・外部送信バッチ基盤",
        dependencies: ["新旧AP", "タスクスケジューラ", "送信先", "重複防止キー"],
        details: ["二重実行: 外部請求の重複リスク", "旧タスク停止確認: 未実施"],
        question: "二重送信を防ぎつつ移行するための運用手順はどれですか？",
      },
    },
  },
  {
    id: "batch-identity",
    title: "タスクの実行環境と運用引継ぎ",
    category: "バッチ",
    dimension: "riskJudge",
    choices: [
      "起動条件・作業ディレクトリ・環境変数・実行ユーザー・再試行・監視先を確認し、担当者と復旧手順を引き継ぐ",
      "実行ファイルだけをコピーし、タスク履歴や監視は移行しない",
      "失敗時は何度でも自動再試行し、重複処理は後から直す",
      "運用担当に説明せず、旧タスクをすぐ削除する",
    ],
    correctAnswers: [0],
    explanation: "バッチの安定運用にはタスク定義、実行環境、失敗検知、再実行時の重複防止、担当者への引継ぎが必要です。",
    consequenceGood: "定期処理の実行と異常時の対応が運用可能な状態で引き継がれます。",
    consequenceBad: "処理失敗が検知されないか、再実行で二重計上が発生します。",
    seniorReview: "移行したタスクの一覧・実行結果・監視通知先・再実行方法を運用設計書に反映しましょう。",
    failureTitle: "失敗が監視されず、再実行で二重処理になる",
    failureDescription: "実行結果の監視と再実行時の重複防止ルールが引き継がれていません。",
    failureImpact: "データ欠落の発見が遅れ、復旧時に二重計上や手作業修正が必要になります。",
    failureFlow: ["バッチ異常", "監視通知なし", "検知遅延", "重複再実行"],
    variants: {
      easy: {
        background: "夜間バッチの担当者が移行後に交代します。旧担当者しか再実行方法を知りません。",
        users: 200, downtimeMinutes: 180, systemType: "日次売上集計",
        dependencies: ["タスクスケジューラ", "監視", "運用担当"],
        details: ["再実行手順: 口頭のみ", "新担当への引継ぎ: 未実施"],
        question: "運用開始前に追加すべき引継ぎは何ですか？",
      },
      normal: {
        background: "バッチ失敗時に自動再試行を設定する提案があります。処理の一部が成功した場合の重複防止仕様は確認されていません。",
        users: 1800, downtimeMinutes: 75, systemType: "日次請求・売上集計",
        dependencies: ["タスクスケジューラ", "DB更新", "再試行", "監視通知"],
        details: ["失敗時の自動再試行: 提案中", "冪等性: 未確認"],
        question: "再試行を有効にする前に必ず確認することは何ですか？",
      },
      hard: {
        background: "複数ジョブが順序依存で実行されます。新旧環境で時刻設定とタイムゾーンが異なり、監視通知先も移行予定です。",
        users: 5000, downtimeMinutes: 25, systemType: "多段ジョブの財務処理",
        dependencies: ["タスクスケジューラ", "タイムゾーン", "ジョブ依存", "監視通知"],
        details: ["旧新の時刻設定差: あり", "ジョブ順序図: 最新でない", "監視先変更: 未試験"],
        question: "連鎖障害を防ぐための切替前検証はどれですか？",
      },
    },
  },
];

export const caseStudyDifficulties: CaseStudyDifficulty[] = ["easy", "normal", "hard"];

const fitScores: Record<string, Record<CaseStudyDifficulty, [number, number, number, number]>> = {
  "dns-ttl": { easy: [3, 2, 1, 2], normal: [3, 1, 2, 2], hard: [2, 1, 3, 2] },
  "dns-split": { easy: [3, 2, 2, 2], normal: [3, 1, 2, 2], hard: [2, 1, 3, 2] },
  "ad-membership": { easy: [3, 2, 1, 2], normal: [3, 1, 2, 2], hard: [2, 1, 3, 2] },
  "ad-trust": { easy: [3, 2, 1, 2], normal: [3, 1, 2, 2], hard: [2, 1, 3, 2] },
  "oracle-window": { easy: [3, 2, 1, 2], normal: [2, 1, 3, 2], hard: [1, 0, 3, 2] },
  "oracle-compatibility": { easy: [3, 2, 2, 1], normal: [3, 1, 2, 2], hard: [2, 1, 3, 2] },
  "datapump-final-sync": { easy: [3, 2, 1, 2], normal: [3, 2, 1, 3], hard: [2, 1, 3, 2] },
  "datapump-validation": { easy: [3, 2, 1, 2], normal: [3, 1, 2, 2], hard: [2, 1, 2, 3] },
  "jdbc-endpoint": { easy: [3, 2, 1, 2], normal: [3, 2, 1, 3], hard: [2, 1, 2, 3] },
  "jdbc-secret": { easy: [3, 2, 1, 2], normal: [2, 2, 1, 3], hard: [2, 1, 3, 2] },
  "user-notice": { easy: [3, 2, 1, 2], normal: [3, 2, 1, 3], hard: [2, 2, 3, 2] },
  "user-audience": { easy: [3, 2, 1, 2], normal: [2, 2, 1, 3], hard: [3, 1, 2, 2] },
  "go-no-go-gates": { easy: [3, 2, 1, 2], normal: [2, 2, 3, 2], hard: [1, 1, 3, 2] },
  "go-no-go-evidence": { easy: [3, 2, 1, 2], normal: [2, 2, 1, 3], hard: [3, 1, 2, 2] },
  "rollback-window": { easy: [3, 2, 2, 2], normal: [3, 2, 3, 2], hard: [2, 1, 3, 3] },
  "rollback-data": { easy: [3, 2, 1, 2], normal: [3, 1, 2, 2], hard: [2, 1, 3, 2] },
  "certificate-private-key": { easy: [3, 2, 1, 2], normal: [3, 2, 1, 2], hard: [2, 1, 3, 2] },
  "certificate-chain": { easy: [3, 2, 2, 1], normal: [3, 2, 1, 2], hard: [2, 1, 3, 2] },
  "batch-schedule": { easy: [3, 2, 1, 2], normal: [2, 2, 1, 3], hard: [2, 1, 3, 2] },
  "batch-identity": { easy: [3, 2, 1, 2], normal: [2, 2, 1, 3], hard: [2, 1, 2, 3] },
};

function getReviewBasis(variant: CaseVariant): string[] {
  return [
    `利用者数: ${variant.users.toLocaleString()}人`,
    `停止可能時間: ${variant.downtimeMinutes}分`,
    ...(variant.databases ?? []),
    ...variant.details,
    `依存関係: ${variant.dependencies.join("・")}`,
  ];
}

function getRationaleFactors(variant: CaseVariant): string[] {
  const details = variant.details.join(" ");
  return rationaleFactorLabels.filter((factor) => {
    if (factor === "利用者数") return true;
    if (factor === "停止可能時間") return true;
    if (factor === "DB容量・更新量") return Boolean(variant.databases?.length)
      || /データ量|更新|差分|Export|Import|同期/i.test(details);
    if (factor === "影響範囲") return variant.users >= 1000 || variant.dependencies.length > 2;
    if (factor === "切戻し時間") return /切戻し|切り戻し|判断期限|停止枠/i.test(details);
    if (factor === "顧客・利用部門の要望") return /顧客|利用部門|業務|承認/i.test(variant.background + details);
    return /SLA|24時間|停止上限|規制|監査|決済/i.test(variant.background + details);
  });
}

function getRehearsal(
  template: CaseTemplate,
  difficulty: CaseStudyDifficulty,
  variant: CaseVariant,
): CaseVariant["rehearsal"] | undefined {
  if (variant.rehearsal) return variant.rehearsal;
  if (template.id !== "oracle-window" && template.category !== "Data Pump") return undefined;
  if (difficulty === "easy") {
    return {
      result: "検証リハーサル: EXPDP 45分 + IMPDP 65分 (合計110分)",
      implication: `停止可能時間 ${variant.downtimeMinutes}分と比較し、最終同期・照合を含めて収まるか判断します。`,
    };
  }
  if (difficulty === "normal") {
    return {
      result: "検証リハーサル: 初回移行 80分 + 最終同期 55分 + 照合 25分 (合計160分)",
      implication: `停止可能時間 ${variant.downtimeMinutes}分に対し、同じ停止時間が必要とは限りません。更新停止点と差分同期方式を再設計します。`,
    };
  }
  return {
    result: "本番想定リハーサル: 初回移行 130分 + 最終同期 35分 + 照合 20分 (合計185分)",
    implication: `停止可能時間 ${variant.downtimeMinutes}分を超過します。Data Pump単独ではなく、更新同期方式や作業枠を再評価する根拠になります。`,
  };
}

function getChoiceReviews(
  template: CaseTemplate,
  difficulty: CaseStudyDifficulty,
  variant: CaseVariant,
): CaseChoiceReview[] {
  const options = variant.choices ?? tradeoffOptions[template.category];
  if (!options) throw new Error(`案件カテゴリの判断選択肢がありません: ${template.category}`);
  const scores = variant.fitScores ?? fitScores[template.id]?.[difficulty];
  if (!scores) throw new Error(`案件条件に応じた適合度がありません: ${template.id}/${difficulty}`);
  return options.map((option, index) => ({
    benefit: option.benefit,
    cost: option.cost,
    fit: scores[index],
  }));
}

function getJudgmentReview(
  template: CaseTemplate,
  variant: CaseVariant,
  options: TradeoffOption[],
  choiceReviews: CaseChoiceReview[],
): string {
  const bestFit = Math.max(...choiceReviews.map((review) => review.fit));
  const bestOptions = choiceReviews
    .map((review, index) => ({ review, index }))
    .filter(({ review }) => review.fit === bestFit)
    .map(({ index }) => options[index].text);
  const leadingOption = bestOptions.map((option) => `「${option}」`).join("または");
  return `利用者${variant.users.toLocaleString()}人・停止可能時間${variant.downtimeMinutes}分を含む条件では、${leadingOption}が相対的に適合度の高い案です。最高評価でも利点だけではなくコストがあり、関係者の合意や追加情報によって別案が妥当になることがあります。${variant.seniorReview ?? template.seniorReview}`;
}

export const caseJudgmentDimensions: Array<{
  id: CaseJudgmentDimension;
  title: string;
}> = [
  { id: "technicalJudge", title: "技術判断" },
  { id: "operationJudge", title: "運用判断" },
  { id: "riskJudge", title: "リスク管理" },
  { id: "communicationJudge", title: "関係者調整" },
  { id: "rollbackJudge", title: "切戻し判断" },
];

export const caseStudyBank: CaseStudyScenario[] = templates.flatMap((template) =>
  caseStudyDifficulties.map((difficulty) => {
    const variant = template.variants[difficulty];
    const options = variant.choices ?? tradeoffOptions[template.category];
    const optionReviews = getChoiceReviews(template, difficulty, variant);
    const reviewBasis = getReviewBasis(variant);
    const rehearsal = getRehearsal(template, difficulty, variant);
    const questionText = `${variant.question}最も適合する案を選んでください。`;
    const relatedText = [
      template.explanation,
      variant.seniorReview ?? template.seniorReview,
      questionText,
      ...options.flatMap((option) => [option.text, option.benefit, option.cost]),
    ].join(" ");
    return {
      id: `${template.id}-${difficulty}`,
      title: `${template.title} · ${difficultyLabels[difficulty]}`,
      category: template.category,
      difficulty,
      background: variant.background,
      conditions: {
        users: variant.users,
        downtimeMinutes: variant.downtimeMinutes,
        systemType: variant.systemType,
        databases: variant.databases,
        dependencies: variant.dependencies,
        details: variant.details,
      },
      questions: [{
        id: `${template.id}-${difficulty}-q1`,
        question: questionText,
        choices: options.map((option) => option.text),
        highestFitChoices: optionReviews.flatMap((review, index) => review.fit === Math.max(...optionReviews.map((item) => item.fit)) ? [index] : []),
        choiceReviews: optionReviews,
        explanation: variant.explanation ?? template.explanation,
        consequenceGood: template.consequenceGood,
        consequenceBad: template.consequenceBad,
        seniorReview: getJudgmentReview(template, variant, options, optionReviews),
        judgmentDimension: template.dimension,
        reviewBasis,
        rationaleFactors: getRationaleFactors(variant),
        glossaryTerms: caseGlossary
          .filter(({ terms }) => terms.some((term) => relatedText.includes(term)))
          .map(({ term }) => term),
        rehearsal,
        failureScenario: {
          title: template.failureTitle,
          description: template.failureDescription,
          impact: template.failureImpact,
          flow: template.failureFlow,
        },
      }],
    } satisfies CaseStudyScenario;
  }),
);

export function getCaseStudies(difficulty: CaseStudyDifficulty): CaseStudyScenario[] {
  return caseStudyBank.filter((item) => item.difficulty === difficulty);
}

export function shuffleCaseStudies(
  cases: readonly CaseStudyScenario[],
  random: () => number = Math.random,
): CaseStudyScenario[] {
  const shuffled = cases.map((scenario) => ({
    ...scenario,
    questions: scenario.questions.map((question) => {
      const options = question.choices.map((text, index) => ({
        text,
        review: question.choiceReviews[index],
      }));
      for (let index = options.length - 1; index > 0; index -= 1) {
        const target = Math.floor(random() * (index + 1));
        [options[index], options[target]] = [options[target], options[index]];
      }
      return {
        ...question,
        choices: options.map((option) => option.text),
        choiceReviews: options.map((option) => option.review),
        highestFitChoices: options.flatMap((option, index) => option.review.fit === Math.max(...options.map((item) => item.review.fit)) ? [index] : []),
      };
    }),
  }));
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[target]] = [shuffled[target], shuffled[index]];
  }
  return shuffled;
}

export function calculateCaseJudgmentScores(answers: readonly CaseStudyAnswer[]): CaseJudgmentScores {
  return Object.fromEntries(caseJudgmentDimensions.map(({ id }) => {
    const matching = answers.filter((answer) => answer.judgmentDimension === id);
    const points = matching.reduce((total, answer) => total + answer.fit, 0);
    const maxPoints = matching.length * 3;
    return [id, {
      points,
      maxPoints,
      total: matching.length,
      percentage: matching.length === 0 ? null : Math.round((points / maxPoints) * 100),
    }];
  })) as CaseJudgmentScores;
}
