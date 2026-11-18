import type { CloudWorkspace, Server } from "./models";

interface IPv4Cidr {
  network: number;
  prefix: number;
}

export const requiredCloudInboundPorts = [3389, 8080, 1521] as const;

export function createInitialCloudWorkspace(): CloudWorkspace {
  return {
    vpcCidr: null,
    subnetCidr: null,
    securityGroupCreated: false,
    securityGroupPorts: [],
    instanceServerIds: [],
  };
}

export function isCloudWorkspaceReady(workspace: CloudWorkspace, targetServers: Server[]): boolean {
  return targetServers.length > 0
    && Boolean(workspace.vpcCidr && workspace.subnetCidr && workspace.securityGroupCreated)
    && requiredCloudInboundPorts.every((port) => workspace.securityGroupPorts.includes(port))
    && targetServers.every((server) =>
      workspace.instanceServerIds.includes(server.id)
      && workspace.subnetCidr !== null
      && isAddressInCidr(server.ipAddress, workspace.subnetCidr),
    );
}

function parseIPv4(address: string): number | null {
  const octets = address.split(".");
  if (octets.length !== 4 || octets.some((octet) => !/^\d{1,3}$/.test(octet))) return null;
  const values = octets.map(Number);
  if (values.some((value) => value < 0 || value > 255)) return null;
  return values.reduce((result, value) => (result * 256 + value) >>> 0, 0);
}

function parseCidr(value: string): IPv4Cidr | null {
  const [address, prefixText, ...extra] = value.trim().split("/");
  if (!address || !prefixText || extra.length > 0 || !/^\d{1,2}$/.test(prefixText)) return null;
  const networkAddress = parseIPv4(address);
  const prefix = Number(prefixText);
  if (networkAddress === null || prefix < 0 || prefix > 32) return null;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const network = (networkAddress & mask) >>> 0;
  if (network !== networkAddress) return null;
  return { network, prefix };
}

export function isValidIPv4Cidr(value: string): boolean {
  return parseCidr(value) !== null;
}

export function isValidAwsVpcCidr(value: string): boolean {
  const cidr = parseCidr(value);
  return Boolean(cidr && cidr.prefix >= 16 && cidr.prefix <= 28);
}

export function isValidAwsSubnetCidr(value: string): boolean {
  const cidr = parseCidr(value);
  return Boolean(cidr && cidr.prefix >= 16 && cidr.prefix <= 28);
}

export function isCidrWithin(parentValue: string, childValue: string): boolean {
  const parent = parseCidr(parentValue);
  const child = parseCidr(childValue);
  if (!parent || !child || child.prefix <= parent.prefix) return false;
  const mask = parent.prefix === 0 ? 0 : (0xffffffff << (32 - parent.prefix)) >>> 0;
  return ((child.network & mask) >>> 0) === parent.network;
}

export function isAddressInCidr(address: string, cidrValue: string): boolean {
  const ip = parseIPv4(address);
  const cidr = parseCidr(cidrValue);
  if (ip === null || !cidr) return false;
  const mask = cidr.prefix === 0 ? 0 : (0xffffffff << (32 - cidr.prefix)) >>> 0;
  return ((ip & mask) >>> 0) === cidr.network;
}
