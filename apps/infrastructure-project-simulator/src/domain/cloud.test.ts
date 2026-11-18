import { describe, expect, it } from "vitest";
import { createInitialCloudWorkspace, isCloudWorkspaceReady } from "./cloud";
import type { Server } from "./models";

const targets: Server[] = [
  {
    id: "ap-new",
    hostname: "APSV02",
    role: "application",
    stage: "target",
    operatingSystem: "Windows Server 2019",
    ipAddress: "10.10.2.21",
    software: [],
    vmIds: [],
  },
  {
    id: "db-new",
    hostname: "DBSV02",
    role: "database",
    stage: "target",
    operatingSystem: "Windows Server 2019",
    ipAddress: "10.10.2.31",
    software: [],
    vmIds: [],
  },
];

describe("cloud infrastructure readiness", () => {
  it("requires the network, both target VMs, and all migration ports", () => {
    const workspace = {
      ...createInitialCloudWorkspace(),
      vpcCidr: "10.10.0.0/16",
      subnetCidr: "10.10.2.0/24",
      securityGroupCreated: true,
      securityGroupPorts: [3389, 8080],
      instanceServerIds: ["ap-new", "db-new"],
    };

    expect(isCloudWorkspaceReady(workspace, targets)).toBe(false);
    expect(isCloudWorkspaceReady({
      ...workspace,
      securityGroupPorts: [3389, 8080, 1521],
    }, targets)).toBe(true);
  });

  it("rejects a target VM whose fixed address is outside the configured subnet", () => {
    const workspace = {
      ...createInitialCloudWorkspace(),
      vpcCidr: "10.10.0.0/16",
      subnetCidr: "10.10.2.0/24",
      securityGroupCreated: true,
      securityGroupPorts: [3389, 8080, 1521],
      instanceServerIds: ["ap-new", "db-new"],
    };

    expect(isCloudWorkspaceReady(workspace, [
      targets[0],
      { ...targets[1], ipAddress: "10.10.3.31" },
    ])).toBe(false);
  });
});
