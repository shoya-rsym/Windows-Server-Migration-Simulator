export interface GlossaryEntry {
  term: string;
  definition: string;
  domains: string[];
}

export const sharedGlossary: GlossaryEntry[] = [
  { term: "受入条件", definition: "成果物を受け入れるか判断するために、事前に合意する検証可能な条件。", domains: ["development", "infrastructure"] },
  { term: "リスク", definition: "将来発生する可能性があり、目的へ影響する不確実な事象。", domains: ["general"] },
  { term: "RPO", definition: "障害時に許容されるデータ損失の目標を時間で示したもの。", domains: ["infrastructure", "development"] },
  { term: "RTO", definition: "障害発生からサービス復旧までの目標時間。", domains: ["infrastructure", "development"] },
  { term: "API", definition: "ソフトウェア同士が機能やデータをやり取りするためのインターフェース。", domains: ["development"] },
];

export const decisionFrameworks = [
  { id: "five-whys", title: "5 Whys", purpose: "事象を起点に問いを重ね、再発防止につながる原因を探る。" },
  { id: "impact-analysis", title: "影響分析", purpose: "変更や障害が利用者、業務、システム、データへ与える影響を整理する。" },
  { id: "risk-analysis", title: "リスク分析", purpose: "発生可能性、影響、検知・緩和策、責任者を整理する。" },
] as const;
