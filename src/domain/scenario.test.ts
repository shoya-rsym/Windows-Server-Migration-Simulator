import { describe, expect, it } from "vitest";
import scenarioDefinition from "../data/scenarios/windows-server-2016-to-2019.json";
import { loadScenario } from "./scenario";

describe("scenario integrity validation", () => {
  it("rejects duplicate asset identifiers", () => {
    const invalidScenario = structuredClone(scenarioDefinition);
    invalidScenario.assets.servers[1].id = invalidScenario.assets.servers[0].id;

    expect(() => loadScenario(invalidScenario)).toThrow("サーバーIDが重複しています");
  });

  it("rejects VM host links that are not reflected in the host server", () => {
    const invalidScenario = structuredClone(scenarioDefinition);
    invalidScenario.assets.vms[0].hostServerId = invalidScenario.assets.servers[1].id;

    expect(() => loadScenario(invalidScenario)).toThrow("VMをホストサーバーのvmIdsにも登録してください");
  });

  it("requires the recommended order to cover every audit check once", () => {
    const invalidScenario = structuredClone(scenarioDefinition);
    invalidScenario.recommendedOrder.pop();

    expect(() => loadScenario(invalidScenario)).toThrow("推奨作業順序には各監査項目をちょうど1回ずつ");
  });

  it("rejects an expert incident without a matching source asset", () => {
    const invalidScenario = structuredClone(scenarioDefinition);
    invalidScenario.assets.tasks = [];

    expect(() => loadScenario(invalidScenario)).toThrow("障害を再現するための移行元資産がありません: task");
  });

  it("rejects tutorial completion events without a matching operation", () => {
    const invalidScenario = structuredClone(scenarioDefinition);
    invalidScenario.tutorialSteps[0].requiredEvents = ["migration:unknown-operation"];

    expect(() => loadScenario(invalidScenario)).toThrow("チュートリアルの完了イベントが見つかりません");
  });
});
