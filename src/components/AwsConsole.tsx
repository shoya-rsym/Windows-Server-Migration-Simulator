import { useState } from "react";
import { Check, Cloud, Network, Plus, Server, Shield, Trash2 } from "lucide-react";
import {
  isAddressInCidr,
  isCidrWithin,
  isValidAwsSubnetCidr,
  isValidAwsVpcCidr,
  requiredCloudInboundPorts,
} from "../domain/cloud";
import type { CloudWorkspace, DeploymentProvider, Server as ServerAsset } from "../domain/models";

type AwsTab = "network" | "security" | "instances";

export function AwsConsole({
  provider,
  servers,
  workspace,
  onChange,
  onConnect,
}: {
  provider: Extract<DeploymentProvider, "aws" | "azure">;
  servers: ServerAsset[];
  workspace: CloudWorkspace;
  onChange: (workspace: CloudWorkspace) => void;
  onConnect: (serverId: string) => void;
}) {
  const [tab, setTab] = useState<AwsTab>("network");
  const [vpcInput, setVpcInput] = useState("");
  const [subnetInput, setSubnetInput] = useState("");
  const [portInput, setPortInput] = useState("");
  const [feedback, setFeedback] = useState("");
  const targets = servers.filter((server) => server.stage === "target" && server.role !== "dns");
  const isAzure = provider === "azure";
  const networkName = isAzure ? "Virtual Network (VNet)" : "VPC";
  const subnetName = "サブネット";
  const securityName = isAzure ? "ネットワーク セキュリティ グループ (NSG)" : "セキュリティグループ";
  const instanceName = isAzure ? "Azure VM" : "EC2";

  const createVpc = () => {
    const cidr = vpcInput.trim();
    if (!isValidAwsVpcCidr(cidr)) {
      setFeedback(`${networkName}のIPv4 CIDRはアドレス境界に合わせ、プレフィックスを/16〜/28で入力してください。`);
      return;
    }
    if (workspace.vpcCidr && workspace.vpcCidr !== cidr
      && !window.confirm(`${networkName}を変更すると、サブネット、${securityName}、起動済み${instanceName}が削除されます。続けますか？`)) return;
    onChange({
      vpcCidr: cidr,
      subnetCidr: workspace.vpcCidr === cidr ? workspace.subnetCidr : null,
      securityGroupCreated: workspace.vpcCidr === cidr && workspace.securityGroupCreated,
      securityGroupPorts: workspace.vpcCidr === cidr ? workspace.securityGroupPorts : [],
      instanceServerIds: workspace.vpcCidr === cidr ? workspace.instanceServerIds : [],
    });
    setFeedback(`${networkName} ${cidr} を作成しました。`);
  };

  const createSubnet = () => {
    const cidr = subnetInput.trim();
    if (!workspace.vpcCidr) {
      setFeedback(`先に${networkName}を作成してください。`);
      return;
    }
    if (!isValidAwsSubnetCidr(cidr) || !isCidrWithin(workspace.vpcCidr, cidr)) {
      setFeedback("サブネットCIDRはアドレス境界に合わせ、/16〜/28かつ作成済みVPCの範囲内にしてください。");
      return;
    }
    if (workspace.subnetCidr && workspace.subnetCidr !== cidr
      && workspace.instanceServerIds.length > 0
      && !window.confirm(`サブネットを変更すると、起動済み${instanceName}が削除されます。続けますか？`)) return;
    onChange({
      ...workspace,
      subnetCidr: cidr,
      instanceServerIds: workspace.subnetCidr === cidr ? workspace.instanceServerIds : [],
    });
    setFeedback(`サブネット ${cidr} を作成しました。`);
  };

  const createSecurityGroup = () => {
    if (!workspace.vpcCidr) {
      setFeedback(`先に${networkName}を作成してください。`);
      return;
    }
    onChange({ ...workspace, securityGroupCreated: true });
    setFeedback(`${securityName}を作成しました。インバウンドルールを追加してください。`);
  };

  const addPort = () => {
    const port = Number(portInput.trim());
    if (!workspace.securityGroupCreated) {
      setFeedback("先にセキュリティグループを作成してください。");
      return;
    }
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      setFeedback("ポート番号は1〜65535の整数で入力してください。");
      return;
    }
    onChange({ ...workspace, securityGroupPorts: [...new Set([...workspace.securityGroupPorts, port])].sort((a, b) => a - b) });
    setPortInput("");
    setFeedback(`TCP ${port} のインバウンドルールを追加しました。`);
  };

  const launchInstance = (server: ServerAsset) => {
    if (!workspace.vpcCidr || !workspace.subnetCidr || !workspace.securityGroupCreated) {
      setFeedback(`${instanceName}の起動には${networkName}、サブネット、${securityName}が必要です。`);
      return;
    }
    if (!isAddressInCidr(server.ipAddress, workspace.subnetCidr)) {
      setFeedback(`${server.hostname} のIP ${server.ipAddress} はサブネット ${workspace.subnetCidr} に含まれていません。`);
      return;
    }
    onChange({ ...workspace, instanceServerIds: [...new Set([...workspace.instanceServerIds, server.id])] });
    setFeedback(`${server.hostname} を${instanceName}として起動しました。`);
  };

  const portLabel = (port: number) => port === 3389 ? "RDP" : port === 8080 ? "アプリHTTP" : port === 1521 ? "Oracle Listener" : "カスタム";
  const targetsReady = targets.every((server) => workspace.instanceServerIds.includes(server.id));
  const missingPorts = requiredCloudInboundPorts.filter((port) => !workspace.securityGroupPorts.includes(port));

  return (
    <section className={`cloud-console aws ${provider}`}>
      <div className="cloud-console-top"><Cloud size={17} /><strong>{isAzure ? "Microsoft Azure" : "AWS Management Console"}</strong><span>training-lab</span></div>
      <div className="cloud-console-title"><small>{isAzure ? "Virtual Network / NSG / Virtual Machines" : "VPC / Security Groups / EC2"}</small><strong>インフラストラクチャ構築</strong></div>
      <div className="cloud-tutorial-concepts"><strong>構築順序と役割</strong><span>{networkName}は閉じたネットワーク、サブネットはIP範囲、{securityName}は通信許可、{instanceName}はサーバー本体です。</span><small>1 ネットワークとサブネット → 2 ファイアウォール → 3 移行先VM起動</small></div>
      <nav className="aws-console-tabs" aria-label={`${provider === "azure" ? "Azure" : "AWS"}リソース`}>
        <button className={tab === "network" ? "active" : ""} onClick={() => setTab("network")}><Network size={13} />ネットワーク</button>
        <button className={tab === "security" ? "active" : ""} onClick={() => setTab("security")}><Shield size={13} />ファイアウォール</button>
        <button className={tab === "instances" ? "active" : ""} onClick={() => setTab("instances")}><Server size={13} />VM</button>
      </nav>

      {tab === "network" && <div className="aws-console-panel">
        <div className="aws-resource-step">
          <strong>1. {networkName}</strong>
          <label>IPv4 CIDR<input value={vpcInput} onChange={(event) => setVpcInput(event.target.value)} placeholder="例: 10.10.0.0/16" /></label>
          <button onClick={createVpc}>{workspace.vpcCidr ? `${networkName}を更新` : `${networkName}を作成`}</button>
          {workspace.vpcCidr && <small><Check size={12} />{workspace.vpcCidr}</small>}
        </div>
        <div className="aws-resource-step">
          <strong>2. {subnetName}</strong>
          <label>IPv4 CIDR<input value={subnetInput} onChange={(event) => setSubnetInput(event.target.value)} placeholder="例: 10.10.2.0/24" /></label>
          <button disabled={!workspace.vpcCidr} onClick={createSubnet}>{workspace.subnetCidr ? `${subnetName}を更新` : `${subnetName}を作成`}</button>
          {workspace.subnetCidr && <small><Check size={12} />{workspace.subnetCidr} ({workspace.vpcCidr} 内)</small>}
        </div>
      </div>}

      {tab === "security" && <div className="aws-console-panel">
        <div className="aws-resource-step">
          <strong>3. {securityName}</strong>
          {!workspace.securityGroupCreated
            ? <button disabled={!workspace.vpcCidr} onClick={createSecurityGroup}>{securityName}を作成</button>
            : <small><Check size={12} />移行用ファイアウォール (TCP)</small>}
          <form onSubmit={(event) => { event.preventDefault(); addPort(); }}>
            <label>インバウンド TCPポート<input inputMode="numeric" value={portInput} onChange={(event) => setPortInput(event.target.value)} placeholder="3389 / 8080 / 1521" /></label>
            <button disabled={!workspace.securityGroupCreated}><Plus size={12} />ルール追加</button>
          </form>
          <ul className="aws-port-list">{workspace.securityGroupPorts.map((port) => (
            <li key={port}><span>TCP {port} · {portLabel(port)}</span><button aria-label={`TCP ${port} ルールを削除`} onClick={() => onChange({ ...workspace, securityGroupPorts: workspace.securityGroupPorts.filter((item) => item !== port) })}><Trash2 size={12} /></button></li>
          ))}</ul>
          {workspace.securityGroupCreated && <small className="aws-port-purpose">TCP 3389=RDP接続、8080=AP疎通、1521=Oracle接続。移行テストで使う通信だけを許可します。</small>}
          {missingPorts.length > 0 && workspace.securityGroupCreated && <small className="aws-warning">未設定の必要ポート: {missingPorts.map((port) => `TCP ${port}`).join("、")}</small>}
        </div>
      </div>}

      {tab === "instances" && <div className="aws-console-panel aws-instance-panel">
        <div className="aws-instance-summary">{workspace.vpcCidr ? `${networkName} ${workspace.vpcCidr}` : `${networkName}未作成`} · {workspace.subnetCidr ?? "サブネット未作成"}</div>
        {targets.map((server) => {
          const launched = workspace.instanceServerIds.includes(server.id);
          const reachable = launched && workspace.securityGroupPorts.includes(3389);
          const inSubnet = workspace.subnetCidr !== null && isAddressInCidr(server.ipAddress, workspace.subnetCidr);
          return <div className="cloud-resource aws-instance" key={server.id}>
            <span className={`cloud-running-dot ${launched ? "" : "stopped"}`} />
            <strong>{server.hostname}</strong>
            <small>{launched ? "running" : "未作成"}</small>
            <span>{server.ipAddress}</span>
            {launched
              ? <button disabled={!reachable} title={reachable ? "RDP接続" : "SGにTCP 3389を追加してください"} onClick={() => onConnect(server.id)}>RDP</button>
              : <button disabled={!workspace.vpcCidr || !workspace.subnetCidr || !workspace.securityGroupCreated} title={!inSubnet && workspace.subnetCidr ? `IP ${server.ipAddress} を含むサブネットが必要` : `${instanceName}を起動`} onClick={() => launchInstance(server)}>起動</button>}
          </div>;
        })}
        <div className={`aws-readiness ${targetsReady && missingPorts.length === 0 ? "ready" : ""}`}>
          {targetsReady && missingPorts.length === 0 ? "移行先VMと必要な通信ルールが準備できました。" : "ネットワーク・サブネット・ファイアウォールを設定し、移行先VMを起動してください。"}
        </div>
      </div>}

      {feedback && <p className="aws-console-feedback" role="status">{feedback}</p>}
    </section>
  );
}
