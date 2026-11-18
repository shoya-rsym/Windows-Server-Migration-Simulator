import { describe, expect, it } from "vitest";
import scenarioDefinition from "../data/scenarios/windows-server-2016-to-2019.json";
import { createLocalAdvisor } from "./advisor";
import { loadScenario } from "./scenario";
import type { AdvisorContext } from "./models";

const scenario = loadScenario(scenarioDefinition);
const databaseServer = scenario.assets.servers.find((server) =>
  server.role === "database" && server.stage === "target",
);
const dnsServer = scenario.assets.servers.find((server) => server.role === "dns");
if (!databaseServer || !dnsServer) throw new Error("Scenario must define database and DNS servers.");

describe("local advisor", () => {
  it("uses the current role and recent failure as investigation evidence", async () => {
    const context: AdvisorContext = {
      scenario,
      server: databaseServer,
      mode: "expert",
      recentCommands: [{
        id: 1,
        command: "lsnrctl status",
        output: ["TNS-12541: TNS:no listener"],
        isError: true,
      }],
      hypotheses: [],
    };

    const advice = await createLocalAdvisor().getAdvice(context);

    expect(advice).toContain("TNS-12541: TNS:no listener");
    expect(advice).toContain("lsnrctl status");
    expect(advice).toContain("原因を決めつけず");
  });

  it("supports DNS-specific troubleshooting and hypothesis verification", async () => {
    const context: AdvisorContext = {
      scenario,
      server: dnsServer,
      mode: "intermediate",
      recentCommands: [],
      hypotheses: [{ id: 1, text: "TTLが高いまま", status: "open" }],
    };

    const advice = await createLocalAdvisor().getAdvice(context);

    expect(advice).toContain(`nslookup ${scenario.assets.dns[0].name}`);
    expect(advice).toContain("TTLが高いまま");
    expect(advice).toContain("反証できる確認");
  });
});
