import { useState } from "react";
import { Check, Cloud, Network, Plus, Server, Shield, Trash2 } from "lucide-react";
import { isAddressInCidr, isCidrWithin, isValidAwsSubnetCidr, isValidAwsVpcCidr } from "../domain/cloud";
import type { CloudWorkspace, Server as ServerAsset } from "../domain/models";

type AwsTab = "network" | "security" | "instances";

export function AwsConsole({
  servers,
  workspace,
  onChange,
  onConnect,
}: {
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

  const createVpc = () => {
    const cidr = vpcInput.trim();
    if (!isValidAwsVpcCidr(cidr)) {
      setFeedback("VPCのIPv4 CIDRはアドレス境界に合わせ、プレフィックスを/16〜/28で入力してください。");
      return;
    }
    if (workspace.vpcCidr && workspace.vpcCidr !== cidr
      && !window.confirm("VPCを変更すると、サブネット、セキュリティグループ、起動済みEC2が削除されます。続けますか？")) return;
    onChange({
      vpcCidr: cidr,
      subnetCidr: workspace.vpcCidr === cidr ? workspace.subnetCidr : null,
      securityGroupCreated: workspace.vpcCidr === cidr && workspace.securityGroupCreated,
      securityGroupPorts: workspace.vpcCidr === cidr ? workspace.securityGroupPorts : [],
      instanceServerIds: workspace.vpcCidr === cidr ? workspace.instanceServerIds : [],
    });
    setFeedback(`VPC ${cidr} を作成しました。`);
  };

  const createSubnet = () => {
    const cidr = subnetInput.trim();
    if (!workspace.vpcCidr) {
      setFeedback("先にVPCを作成してください。");
      return;
    }
    if (!isValidAwsSubnetCidr(cidr) || !isCidrWithin(workspace.vpcCidr, cidr)) {
      setFeedback("サブネットCIDRはアドレス境界に合わせ、/16〜/28かつ作成済みVPCの範囲内にしてください。");
      return;
    }
    if (workspace.subnetCidr && workspace.subnetCidr !== cidr
      && workspace.instanceServerIds.length > 0
      && !window.confirm("サブネットを変更すると、起動済みEC2が削除されます。続けますか？")) return;
    onChange({
      ...workspace,
      subnetCidr: cidr,
      instanceServerIds: workspace.subnetCidr === cidr ? workspace.instanceServerIds : [],
    });
    setFeedback(`サブネット ${cidr} を作成しました。`);
  };

  const createSecurityGroup = () => {
    if (!workspace.vpcCidr) {
      setFeedback("先にVPCを作成してください。");
      return;
    }
    onChange({ ...workspace, securityGroupCreated: true });
    setFeedback("セキュリティグループを作成しました。インバウンドルールを追加してください。");
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
      setFeedback("EC2起動にはVPC、サブネット、セキュリティグループが必要です。");
      return;
    }
    if (!isAddressInCidr(server.ipAddress, workspace.subnetCidr)) {
      setFeedback(`${server.hostname} のIP ${server.ipAddress} はサブネット ${workspace.subnetCidr} に含まれていません。`);
      return;
    }
    onChange({ ...workspace, instanceServerIds: [...new Set([...workspace.instanceServerIds, server.id])] });
    setFeedback(`${server.hostname} をEC2として起動しました。`);
  };

  const portLabel = (port: number) => port === 3389 ? "RDP" : port === 8080 ? "アプリHTTP" : port === 1521 ? "Oracle Listener" : "カスタム";
  const targetsReady = targets.every((server) => workspace.instanceServerIds.includes(server.id));

  return (
    <section className="cloud-console aws">
      <div className="cloud-console-top"><Cloud size={17} /><strong>AWS Management Console</strong><span>training-lab</span></div>
      <div className="cloud-console-title"><small>VPC / Security Groups / EC2</small><strong>インフラストラクチャ構築</strong></div>
      <nav className="aws-console-tabs" aria-label="AWSリソース">
        <button className={tab === "network" ? "active" : ""} onClick={() => setTab("network")}><Network size={13} />ネットワーク</button>
        <button className={tab === "security" ? "active" : ""} onClick={() => setTab("security")}><Shield size={13} />セキュリティ</button>
        <button className={tab === "instances" ? "active" : ""} onClick={() => setTab("instances")}><Server size={13} />EC2</button>
      </nav>

      {tab === "network" && <div className="aws-console-panel">
        <div className="aws-resource-step">
          <strong>1. VPC</strong>
          <label>IPv4 CIDR<input value={vpcInput} onChange={(event) => setVpcInput(event.target.value)} placeholder="例: 10.10.0.0/16" /></label>
          <button onClick={createVpc}>{workspace.vpcCidr ? "VPCを更新" : "VPCを作成"}</button>
          {workspace.vpcCidr && <small><Check size={12} />{workspace.vpcCidr}</small>}
        </div>
        <div className="aws-resource-step">
          <strong>2. サブネット</strong>
          <label>IPv4 CIDR<input value={subnetInput} onChange={(event) => setSubnetInput(event.target.value)} placeholder="例: 10.10.2.0/24" /></label>
          <button disabled={!workspace.vpcCidr} onClick={createSubnet}>{workspace.subnetCidr ? "サブネットを更新" : "サブネットを作成"}</button>
          {workspace.subnetCidr && <small><Check size={12} />{workspace.subnetCidr} ({workspace.vpcCidr} 内)</small>}
        </div>
      </div>}

      {tab === "security" && <div className="aws-console-panel">
        <div className="aws-resource-step">
          <strong>3. セキュリティグループ</strong>
          {!workspace.securityGroupCreated
            ? <button disabled={!workspace.vpcCidr} onClick={createSecurityGroup}>セキュリティグループを作成</button>
            : <small><Check size={12} />移行用SG (TCP)</small>}
          <form onSubmit={(event) => { event.preventDefault(); addPort(); }}>
            <label>インバウンド TCPポート<input inputMode="numeric" value={portInput} onChange={(event) => setPortInput(event.target.value)} placeholder="3389 / 8080 / 1521" /></label>
            <button disabled={!workspace.securityGroupCreated}><Plus size={12} />ルール追加</button>
          </form>
          <ul className="aws-port-list">{workspace.securityGroupPorts.map((port) => (
            <li key={port}><span>TCP {port} · {portLabel(port)}</span><button aria-label={`TCP ${port} ルールを削除`} onClick={() => onChange({ ...workspace, securityGroupPorts: workspace.securityGroupPorts.filter((item) => item !== port) })}><Trash2 size={12} /></button></li>
          ))}</ul>
          {!workspace.securityGroupPorts.includes(3389) && workspace.securityGroupCreated && <small className="aws-warning">TCP 3389がないため、EC2へRDP接続できません。</small>}
        </div>
      </div>}

      {tab === "instances" && <div className="aws-console-panel aws-instance-panel">
        <div className="aws-instance-summary">{workspace.vpcCidr ? `VPC ${workspace.vpcCidr}` : "VPC未作成"} · {workspace.subnetCidr ?? "サブネット未作成"}</div>
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
              : <button disabled={!workspace.vpcCidr || !workspace.subnetCidr || !workspace.securityGroupCreated} title={!inSubnet && workspace.subnetCidr ? `IP ${server.ipAddress} を含むサブネットが必要` : "EC2を起動"} onClick={() => launchInstance(server)}>起動</button>}
          </div>;
        })}
        <div className={`aws-readiness ${targetsReady ? "ready" : ""}`}>
          {targetsReady ? "移行先EC2はすべて起動済みです。" : "VPC・サブネット・セキュリティグループを作成し、移行先EC2を起動してください。"}
        </div>
      </div>}

      {feedback && <p className="aws-console-feedback" role="status">{feedback}</p>}
    </section>
  );
}
