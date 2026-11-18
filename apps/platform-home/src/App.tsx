import { ArrowRight, BookOpenCheck, Code2, Server } from "lucide-react";

const simulators = [
  {
    title: "Windows Server移行シミュレーター",
    englishTitle: "Infrastructure Project Simulator",
    description:
      "現行調査から移行計画、環境構築、本番切替、障害対応まで。サーバー移行案件の判断を体験します。",
    href: __SIMULATOR_URLS__.infrastructure,
    label: "インフラ案件",
    icon: Server,
    className: "infrastructure",
    highlights: ["現行調査・構成理解", "移行と本番切替", "障害対応・切戻し"],
  },
  {
    title: "EC商品検索 開発案件演習",
    englishTitle: "Development Project Simulator",
    description:
      "顧客要望の整理から要件定義、設計、試験、リリース、運用引継ぎまで、12の判断をつなげて学びます。",
    href: __SIMULATOR_URLS__.development,
    label: "開発案件",
    icon: Code2,
    className: "development",
    highlights: ["要件定義・計画", "設計・テスト", "リリース・運用"],
  },
];

export function App() {
  return (
    <main className="platform">
      <header className="topbar">
        <a className="brand" href="/" aria-label="System Engineer Simulator Platform">
          <span className="brand-mark">SE</span>
          <span className="brand-name">
            <strong>System Engineer</strong>
            <span>SIMULATOR PLATFORM</span>
          </span>
        </a>
        <span className="topbar-note">
          <BookOpenCheck size={16} aria-hidden="true" />
          案件判断力を学ぶ
        </span>
      </header>

      <section className="hero">
        <p className="eyebrow">LEARN THROUGH PROJECT DECISIONS</p>
        <h1>
          次の案件に必要な判断を、
          <br />
          ここで体験する。
        </h1>
        <p className="hero-copy">
          技術の暗記ではなく、何を調べ、誰に相談し、何を根拠に決めるか。
          <br className="desktop-break" />
          実案件の流れに沿って、SEの判断力を身につけます。
        </p>
      </section>

      <section className="simulator-section" aria-labelledby="simulator-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">CHOOSE A SIMULATOR</p>
            <h2 id="simulator-heading">学習する案件を選択</h2>
          </div>
          <span className="audience">対象：新人〜中堅SE</span>
        </div>

        <div className="simulator-grid">
          {simulators.map((simulator) => {
            const Icon = simulator.icon;
            return (
              <article className={`simulator-card ${simulator.className}`} key={simulator.englishTitle}>
                <div className="card-heading">
                  <span className="card-icon">
                    <Icon size={23} strokeWidth={1.8} aria-hidden="true" />
                  </span>
                  <span className="card-label">{simulator.label}</span>
                </div>
                <p className="card-english">{simulator.englishTitle}</p>
                <h3>{simulator.title}</h3>
                <p className="card-description">{simulator.description}</p>
                <ul className="highlight-list">
                  {simulator.highlights.map((highlight) => (
                    <li key={highlight}>{highlight}</li>
                  ))}
                </ul>
                <a className="launch-link" href={simulator.href}>
                  演習をはじめる
                  <ArrowRight size={17} aria-hidden="true" />
                </a>
              </article>
            );
          })}
        </div>
      </section>

      <section className="learning-cycle" aria-label="学習サイクル">
        <span>案件を理解する</span>
        <i aria-hidden="true" />
        <span>根拠を集める</span>
        <i aria-hidden="true" />
        <span>判断・説明する</span>
        <i aria-hidden="true" />
        <span>結果から振り返る</span>
      </section>

      <footer className="footer">
        学習用シミュレーターです。実サーバーや外部システムには接続しません。
      </footer>
    </main>
  );
}
