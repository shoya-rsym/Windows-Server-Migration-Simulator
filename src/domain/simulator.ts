import type {
  CommandOutput,
  Database,
  DatabaseMigrationStrategy,
  DNS,
  IncidentDefinition,
  ManagerApp,
  RuntimeEnvironment,
  RuntimeEnvironments,
  Scenario,
  Server,
  TransferPackage,
} from "./models";

export interface DnsRuntime {
  address: string;
  cachedAddress: string;
  ttlSeconds: number;
}

export interface ShellResult {
  output: string[];
  managerApp?: ManagerApp;
  clear?: boolean;
  flushDns?: boolean;
  transfer?: TransferPackage;
  databaseTransfer?: "export" | "import";
  databaseAction?: "switchover";
}

export function jdbcPropertiesTargetDatabase(content: string, server: Server, database: Database): boolean {
  const url = content.match(/^jdbc\.url=(\S+)/im)?.[1];
  return Boolean(url && databaseUrlTargetsDatabase(url, server, database));
}

function databaseUrlTargetsDatabase(url: string, server: Server, database: Database): boolean {
  const target = url.match(/@([^:/\s'"]+):(\d+):([^/\s'"]+)/i);
  return Boolean(
    target
      && (target[1].toLowerCase() === server.hostname.toLowerCase() || target[1] === server.ipAddress)
      && Number(target[2]) === database.listenerPort
      && target[3].toLowerCase() === database.serviceName.toLowerCase(),
  );
}

export const initialJdbcProperties =
  "jdbc.url=jdbc:oracle:thin:@DBSV01:1521:ORCL\njdbc.user=IMART\njdbc.password=${DB_PASSWORD}";

export function createRuntimeEnvironments(scenario: Scenario): RuntimeEnvironments {
  const sourceDatabase = scenario.assets.servers.find((server) => server.role === "database" && server.stage === "source");
  const sourceDatabasePort = sourceDatabase
    ? scenario.assets.databases.find((database) => database.serverId === sourceDatabase.id)?.listenerPort ?? 1521
    : 1521;
  const sourceServiceName = sourceDatabase
    ? scenario.assets.databases.find((database) => database.serverId === sourceDatabase.id)?.serviceName
    : undefined;
  return Object.fromEntries(
    scenario.assets.servers.map((server) => [
      server.id,
      {
        installedSoftware: server.stage === "target" ? [] : [...server.software],
        services: scenario.assets.services
          .filter((service) => service.serverId === server.id)
          .filter(() => server.stage !== "target")
          .map((service) => ({ ...service, status: "running" as const })),
        tasks: scenario.assets.tasks.filter((task) => task.serverId === server.id),
        certificates: scenario.assets.certificates.filter((certificate) => certificate.serverId === server.id),
        configurationFiles: scenario.assets.configurationFiles.filter((file) => file.serverId === server.id),
        jdbcProperties: server.role === "application" && server.stage === "source" && sourceDatabase && sourceServiceName
          ? `jdbc.url=jdbc:oracle:thin:@${sourceDatabase.hostname}:${sourceDatabasePort}:${sourceServiceName}\njdbc.user=IMART\njdbc.******`
          : null,
        databaseVersion: server.stage === "target"
          ? null
          : scenario.assets.databases.find((database) => database.serverId === server.id)?.version ?? null,
        databaseSchemas: server.stage === "target"
          ? []
          : scenario.assets.databases.find((database) => database.serverId === server.id)?.schemas ?? [],
        databaseRevision: 0,
        databaseRole: server.stage === "source" ? "primary" : "unconfigured",
        dataGuardEnabled: false,
      } satisfies RuntimeEnvironment,
    ]),
  );
}

export function chooseExpertIncident(scenario: Scenario, random: () => number = Math.random): IncidentDefinition {
  const candidates = scenario.incidents.filter((incident) =>
    ["service", "certificate", "jdbc", "task"].includes(incident.requiredAsset),
  );
  if (!candidates.length) throw new Error("エキスパートモード用の対応可能な障害が定義されていません。");
  const value = random();
  if (!Number.isFinite(value)) throw new Error("障害イベントの抽選値が不正です。");
  const index = Math.min(candidates.length - 1, Math.max(0, Math.floor(value * candidates.length)));
  return candidates[index];
}

export function createExpertRuntimeEnvironments(scenario: Scenario, incidentId: string): RuntimeEnvironments {
  const incident = scenario.incidents.find((item) => item.id === incidentId
    && ["service", "certificate", "jdbc", "task"].includes(item.requiredAsset));
  if (!incident) throw new Error(`エキスパート障害が見つかりません: ${incidentId}`);

  const environments = createRuntimeEnvironments(scenario);
  const sourceApplication = scenario.assets.servers.find((server) => server.role === "application" && server.stage === "source");
  const targetApplication = scenario.assets.servers.find((server) => server.role === "application" && server.stage === "target");
  const sourceDatabase = scenario.assets.servers.find((server) => server.role === "database" && server.stage === "source");
  const targetDatabase = scenario.assets.servers.find((server) => server.role === "database" && server.stage === "target");
  if (!sourceApplication || !targetApplication || !sourceDatabase || !targetDatabase) {
    throw new Error("エキスパートモードには新旧AP・DBサーバーが必要です。");
  }
  const sourceApplicationEnvironment = environments[sourceApplication.id];
  const targetApplicationEnvironment = environments[targetApplication.id];
  const sourceDatabaseEnvironment = environments[sourceDatabase.id];
  const targetDatabaseEnvironment = environments[targetDatabase.id];
  if (!sourceApplicationEnvironment || !targetApplicationEnvironment || !sourceDatabaseEnvironment || !targetDatabaseEnvironment) {
    throw new Error("エキスパートモードのサーバー環境が正しく定義されていません。");
  }

  const migratedApplication: RuntimeEnvironment = {
    ...targetApplicationEnvironment,
    installedSoftware: [...targetApplication.software],
    services: sourceApplicationEnvironment.services.map((service) => ({
      ...service,
      serverId: targetApplication.id,
      status: "running",
    })),
    tasks: sourceApplicationEnvironment.tasks.map((task) => ({ ...task, serverId: targetApplication.id })),
    certificates: sourceApplicationEnvironment.certificates.map((certificate) => ({
      ...certificate,
      serverId: targetApplication.id,
    })),
    configurationFiles: sourceApplicationEnvironment.configurationFiles.map((file) => ({
      ...file,
      serverId: targetApplication.id,
      content: file.content
        .replaceAll(sourceApplication.ipAddress, targetApplication.ipAddress)
        .replaceAll(sourceDatabase.hostname, targetDatabase.hostname),
    })),
    jdbcProperties: sourceApplicationEnvironment.jdbcProperties?.replaceAll(sourceDatabase.hostname, targetDatabase.hostname) ?? null,
  };
  environments[targetApplication.id] = migratedApplication;
  environments[targetDatabase.id] = {
    ...targetDatabaseEnvironment,
    installedSoftware: [...targetDatabase.software],
    services: scenario.assets.services
      .filter((service) => service.serverId === targetDatabase.id)
      .map((service) => ({ ...service, status: "running" as const })),
    databaseVersion: scenario.assets.databases.find((database) => database.serverId === targetDatabase.id)?.version ?? null,
    databaseSchemas: [...sourceDatabaseEnvironment.databaseSchemas],
    databaseRevision: sourceDatabaseEnvironment.databaseRevision,
  };

  if (incident.requiredAsset === "service") {
    const resin = migratedApplication.services.find((service) => service.name.toLowerCase().includes("resin"));
    if (!resin) throw new Error("選択されたサービス障害に対応するResinサービスがありません。");
    environments[targetApplication.id] = {
      ...migratedApplication,
      services: migratedApplication.services.map((service) => service.id === resin.id ? { ...service, status: "stopped" } : service),
    };
  } else if (incident.requiredAsset === "certificate") {
    const tlsCertificate = migratedApplication.certificates.find((certificate) =>
      certificate.hasPrivateKey && certificate.subject.toLowerCase().includes(scenario.assets.dns[0]?.name.toLowerCase() ?? ""),
    );
    if (!tlsCertificate) throw new Error("選択された証明書障害に対応する秘密鍵付き証明書がありません。");
    environments[targetApplication.id] = {
      ...migratedApplication,
      certificates: migratedApplication.certificates.filter((certificate) => certificate.id !== tlsCertificate.id),
    };
  } else if (incident.requiredAsset === "jdbc") {
    if (!sourceApplicationEnvironment.jdbcProperties) throw new Error("選択されたJDBC障害に対応する現行設定がありません。");
    environments[targetApplication.id] = { ...migratedApplication, jdbcProperties: sourceApplicationEnvironment.jdbcProperties };
  } else {
    if (!migratedApplication.tasks.length) throw new Error("選択されたタスク障害に対応する定期タスクがありません。");
    environments[targetApplication.id] = { ...migratedApplication, tasks: [] };
  }
  return environments;
}

export function initialDnsRuntime(dns: DNS): DnsRuntime {
  return { address: dns.address, cachedAddress: dns.address, ttlSeconds: dns.ttlSeconds };
}

export function runCommand(
  rawCommand: string,
  server: Server,
  scenario: Scenario,
  environment: RuntimeEnvironment,
  environments: RuntimeEnvironments,
  dns: DnsRuntime,
  allowedInboundPorts?: number[],
  migrationStrategy: DatabaseMigrationStrategy = "expdp",
): ShellResult {
  const command = rawCommand.trim();
  const normalized = command.toLowerCase().replace(/\s+/g, " ");
  const args = normalized.split(" ");

  if (!command) return { output: [] };
  if (normalized === "cls" || normalized === "clear") return { output: [], clear: true };
  if (normalized === "hostname") return { output: [server.hostname] };
  if (normalized === "whoami") return { output: [`${server.hostname}\\Administrator`] };
  if (normalized === "ver") return { output: [`Microsoft Windows [Version ${server.operatingSystem.includes("2019") ? "10.0.17763.0" : "10.0.14393.0"}]`] };
  if (normalized === "systeminfo") return { output: systemInfo(server, scenario) };
  if (normalized === "java -version") {
    const java = environment.installedSoftware.find((item) => item.toLowerCase().startsWith("java "));
    return java
      ? { output: [`java version "${java.slice(5)}"`, "Java(TM) SE Runtime Environment", "Java HotSpot(TM) 64-Bit Server VM"] }
      : { output: ["'java' is not recognized as an internal or external command,", "operable program or batch file."] };
  }
  if (normalized === "ipconfig" || normalized === "ipconfig /all") return { output: ipConfig(server, scenario) };
  if (normalized === "ipconfig /flushdns") {
    return { output: ["Windows IP Configuration", "Successfully flushed the DNS Resolver Cache."], flushDns: true };
  }
  if (normalized === "netstat" || normalized === "netstat -ano" || normalized === "netstat -an") {
    return { output: netstat(server, scenario, environment, environments, allowedInboundPorts) };
  }
  if (normalized === "route print") {
    const network = server.ipAddress.split(".").slice(0, 3).join(".");
    const gateway = `${network}.1`;
    return {
      output: [
        "===========================================================================\n",
        "IPv4 Route Table",
        "===========================================================================\n",
        "Network Destination        Netmask          Gateway       Interface  Metric",
        "          0.0.0.0          0.0.0.0        " + gateway + "      " + server.ipAddress + "     25",
        `       ${network}.0    255.255.255.0         On-link      ${server.ipAddress}    281`,
        `      ${network}.255  255.255.255.255       On-link      ${server.ipAddress}    281`,
        "===========================================================================",
      ],
    };
  }
  if (args[0] === "nslookup") return { output: nslookup(args[1], scenario, dns) };
  if (args[0] === "ping") return { output: ping(args[1], scenario, dns) };
  if (normalized.startsWith("curl http://")) {
    const request = normalized.match(/^curl http:\/\/([^/:]+)(?::(\d+))?(?:\/.*)?$/);
    if (!request) return { output: ["curl: URL の形式が正しくありません。"] };
    const host = request[1];
    const port = Number(request[2] ?? "80");
    const dnsName = scenario.assets.dns.find((record) => record.name.toLowerCase() === host);
    const address = dnsName ? dns.cachedAddress : undefined;
    const target = scenario.assets.servers.find((item) =>
      item.role === "application"
      && (item.hostname.toLowerCase() === host || item.ipAddress === host || (address !== undefined && item.ipAddress === address)),
    );
    if (!target || port !== 8080) {
      return { output: ["HTTP/1.1 503 Service Unavailable", "接続先またはポートを確認してください。"] };
    }
    if (allowedInboundPorts && !allowedInboundPorts.includes(port)) {
      return { output: ["HTTP/1.1 503 Service Unavailable", "原因: Security Group が TCP 8080 を遮断しています。"] };
    }
    const issues = applicationHealthIssues(target, scenario, environments, allowedInboundPorts);
    return issues.length
      ? { output: ["HTTP/1.1 503 Service Unavailable", ...issues.map((issue) => `原因: ${issue}`)] }
      : { output: ["HTTP/1.1 200 OK", `接続先: ${target.hostname}:${port}`, "intra-mart login page"] };
  }
  if (normalized === "dir" || normalized === "dir c:\\imart") return { output: directoryListing(server, environment) };
  if (normalized === "type jdbc.properties" || normalized === "type c:\\imart\\config\\jdbc.properties") {
    return environment.jdbcProperties
      ? { output: environment.jdbcProperties.split("\n") }
      : { output: ["The system cannot find the file specified."] };
  }
  if (normalized === "type resin.conf" || normalized === "type c:\\resin\\conf\\resin.conf") {
    const resinConfig = environment.configurationFiles.find((file) => file.name.toLowerCase() === "resin.conf");
    return resinConfig
      ? { output: resinConfig.content.split("\n") }
      : { output: ["The system cannot find the file specified."] };
  }
  if (normalized === "sc query") return { output: serviceQuery(environment) };
  if (normalized === "lsnrctl status" && server.role === "database") {
    const database = scenario.assets.databases.find((item) => item.serverId === server.id);
    if (!environment.databaseVersion) {
      return { output: ["'lsnrctl' is not recognized as an internal or external command,", "operable program or batch file."] };
    }
    if (!oracleListenerRunning(environment)) {
      return { output: ["TNS-12541: TNS:no listener", "The listener is not running."] };
    }
    return {
      output: [
        `LSNRCTL for ${environment.databaseVersion ?? "Oracle"} - Production`,
        `Connecting to (HOST=${server.hostname})(PORT=${database?.listenerPort ?? 1521})`,
        "STATUS of the LISTENER",
        `Service "${database?.serviceName ?? server.hostname}" has 1 instance(s).`,
        `  Instance "${database?.serviceName ?? server.hostname}", status READY`,
      ],
    };
  }
  if (
    server.role === "database"
    && !environment.databaseVersion
    && (normalized.startsWith("sqlplus") || normalized.startsWith("expdp") || normalized.startsWith("impdp")
      || normalized.startsWith("rman") || normalized.startsWith("dgmgrl"))
  ) {
    return { output: ["Oracle Database is not installed. Run the scenario installer before using SQL*Plus or database migration commands."] };
  }
  if (
    server.role === "database"
    && environment.databaseVersion
    && !oracleListenerRunning(environment)
    && (normalized.startsWith("sqlplus") || normalized.startsWith("expdp") || normalized.startsWith("impdp")
      || normalized.startsWith("rman") || normalized.startsWith("dgmgrl"))
  ) {
    return { output: ["ORA-12541: TNS:no listener", "Start the Oracle service and Listener before database migration operations."] };
  }
  if (args[0] === "rman") {
    if (migrationStrategy !== "rman") {
      return { output: ["The project plan selects a different database migration strategy. Check the project desk before using RMAN."] };
    }
    if (server.role !== "database") return { output: ["RMAN must be run on a database server."] };
    if (args[1] === "backup" && server.stage === "source") {
      if (environment.databaseRole !== "primary") return { output: ["RMAN-06004: Backup must run on the current primary database."] };
      if (!environment.databaseSchemas.length) return { output: ["RMAN-06004: No database schemas are available to back up."] };
      return {
        output: [
          `RMAN backup completed on ${server.hostname}.`,
          `Database revision: ${environment.databaseRevision}`,
          "Restore the backup on the target. Updates made afterward require a new backup and restore.",
        ],
        databaseTransfer: "export",
      };
    }
    if (args[1] === "restore" && server.stage === "target") {
      return { output: ["RMAN restore requested.", "Restore the latest source backup and recover the database."] , databaseTransfer: "import" };
    }
    return { output: ["Use `rman backup` on the source DB and `rman restore` on the target DB."] };
  }
  if (args[0] === "dgmgrl") {
    if (migrationStrategy !== "dataguard") {
      return { output: ["The project plan selects a different database migration strategy. Check the project desk before using Data Guard."] };
    }
    if (server.role !== "database") return { output: ["Data Guard Broker must be run for a database server."] };
    if (args[1] === "prepare" && server.stage === "source") {
      if (environment.databaseRole !== "primary") return { output: ["ORA-16664: Data Guard preparation must run on the current primary."] };
      if (!environment.databaseSchemas.length) return { output: ["ORA-16024: No database schemas are available for the standby."] };
      return {
        output: [
          `Standby preparation completed from ${server.hostname}.`,
          `Synchronized revision: ${environment.databaseRevision}`,
          "Start the standby on the target DB, then verify synchronization before switchover.",
        ],
        databaseTransfer: "export",
      };
    }
    if (args[1] === "start" && args[2] === "standby" && server.stage === "target") {
      return { output: ["Starting physical standby from the prepared primary snapshot."], databaseTransfer: "import" };
    }
    if (args[1] === "switchover" && server.stage === "target") {
      if (environment.databaseRole !== "standby" || !environment.dataGuardEnabled) {
        return { output: ["ORA-16664: Target is not configured as a synchronized standby. Prepare and start the standby first."] };
      }
      const sourceDatabaseServer = scenario.assets.servers.find((candidate) =>
        candidate.role === "database" && candidate.stage === "source",
      );
      const source = sourceDatabaseServer ? environments[sourceDatabaseServer.id] : undefined;
      if (!source || source.databaseRole !== "primary" || environment.databaseRevision !== source.databaseRevision) {
        return { output: ["ORA-16766: Standby is not synchronized with the primary. Resolve the apply lag before switchover."] };
      }
      return {
        output: [
          "Data Guard switchover completed.",
          `New primary revision: ${environment.databaseRevision}`,
          "The former primary is now a standby.",
        ],
        databaseAction: "switchover",
      };
    }
    return { output: ["Use `dgmgrl prepare` on the source, `dgmgrl start standby` on the target, then `dgmgrl switchover` after synchronization."] };
  }
  if (args[0] === "expdp" || args[0] === "impdp") {
    if (migrationStrategy !== "expdp") {
      return { output: ["The project plan selects a different database migration strategy. Use the commands for the selected method."] };
    }
    if (server.role !== "database") {
      return { output: ["Data Pump must be run on a database server."] };
    }
    if (args[0] === "expdp" && server.stage !== "source") {
      return { output: ["Run expdp on the source database. Use impdp on the target database."] };
    }
    if (args[0] === "impdp" && server.stage !== "target") {
      return { output: ["Run impdp on the target database after exporting from the source database."] };
    }
    if (args[0] === "expdp") {
      if (!environment.databaseSchemas.length) {
        return { output: ["ORA-39166: No user schemas are available to export."] };
      }
      return {
        output: [
          `Export: Release ${environment.databaseVersion} - Production`,
          `Connected to: Oracle Database ${environment.databaseVersion} on ${server.hostname}`,
          `Exporting schemas: ${environment.databaseSchemas.join(", ")}`,
          `Database revision: ${environment.databaseRevision}`,
          `Job "SYS_EXPORT_SCHEMA_01" successfully completed.`,
        ],
        databaseTransfer: "export",
      };
    }
    return {
      output: [
        `Import: Release ${environment.databaseVersion} - Production`,
        `Connected to: Oracle Database ${environment.databaseVersion} on ${server.hostname}`,
        "Data Pump import completed.",
      ],
      databaseTransfer: "import",
    };
  }
  if (args[0] === "tnsping") {
    const alias = args[1];
    const targetDatabase = scenario.assets.databases
      .map((database) => ({
        database,
        server: scenario.assets.servers.find((item) => item.id === database.serverId),
      }))
      .find(({ database, server: targetServer }) =>
        targetServer !== undefined
        && (targetServer.hostname.toLowerCase() === alias
          || targetServer.ipAddress.toLowerCase() === alias
          || database.serviceName.toLowerCase() === alias)
        && (targetServer.stage === server.stage || !scenario.assets.databases.some((item) =>
          item.serviceName.toLowerCase() === alias
          && scenario.assets.servers.find((candidate) => candidate.id === item.serverId)?.stage === server.stage,
        )),
      );
    if (!targetDatabase?.server) {
      return { output: [`TNS-03505: Failed to resolve name ${alias ?? ""}`] };
    }

    const targetEnvironment = environments[targetDatabase.server.id];
    if (!targetEnvironment || !oracleListenerRunning(targetEnvironment)) {
      return { output: ["TNS-12541: TNS:no listener", `Listener is not running on ${targetDatabase.server.hostname}.`] };
    }
    if (allowedInboundPorts && !allowedInboundPorts.includes(targetDatabase.database.listenerPort)) {
      return { output: ["TNS-12541: TNS:no listener", `TCP ${targetDatabase.database.listenerPort} is blocked by the Security Group.`] };
    }
    return {
      output: [
        `TNS Ping Utility for ${targetDatabase.server.hostname}`,
        `Attempting to contact (HOST=${targetDatabase.server.hostname})(PORT=${targetDatabase.database.listenerPort})(SERVICE_NAME=${targetDatabase.database.serviceName})`,
        "OK (10 msec)",
      ],
    };
  }

  const manager = managerForCommand(normalized, server);
  if (manager) {
    return {
      output: [`${manager.displayName} を起動しています...`],
      managerApp: manager.app,
    };
  }

  if (normalized === "help" || normalized === "help /?") {
    return { output: helpText };
  }

  if (normalized.startsWith("cd")) return { output: ["C:\\Users\\Administrator"] };

  const staticOutput = findScenarioCommand(command, scenario);
  if (staticOutput) return { output: staticOutput.output };

  return {
    output: [`'${command.split(" ")[0]}' is not recognized as an internal or external command,`, "operable program or batch file."],
    clear: false,
  };
}

function applicationHealthIssues(
  application: Server,
  scenario: Scenario,
  environments: RuntimeEnvironments,
  allowedInboundPorts?: number[],
): string[] {
  const environment = environments[application.id];
  if (!environment) return ["アプリケーション環境が見つかりません。"];
  const issues: string[] = [];
  if (!environment.installedSoftware.some((software) => software.toLowerCase().startsWith("java "))) {
    issues.push("Javaがインストールされていません。Resinの実行環境を確認してください。");
  }
  if (!environment.installedSoftware.some((software) => software.toLowerCase().startsWith("resin "))) {
    issues.push("Resinがインストールされていません。");
  }
  const resin = environment.services.find((service) => service.name.toLowerCase().includes("resin"));
  if (!resin || resin.status !== "running") issues.push("Resin Windowsサービスが存在しないか、停止しています。");
  const resinConfig = environment.configurationFiles.find((file) => file.name.toLowerCase() === "resin.conf");
  if (!resinConfig?.content.includes(application.ipAddress)) issues.push(`resin.conf の待受アドレスが ${application.ipAddress} ではありません。`);

  const sourceApplication = scenario.assets.servers.find((item) =>
    item.role === "application" && item.stage === "source",
  );
  const sourceResinConfig = scenario.assets.configurationFiles.find((file) =>
    file.serverId === sourceApplication?.id && file.name.toLowerCase() === "resin.conf",
  );
  const database = scenario.assets.servers.find((server) =>
    server.role === "database" && server.stage === application.stage,
  );
  const databaseConfig = database && scenario.assets.databases.find((item) => item.serverId === database.id);
  const databaseEnvironment = database && environments[database.id];
  if (!database || !databaseConfig || !databaseEnvironment) {
    issues.push("同じ世代のDB環境が見つかりません。");
  } else {
    if (!oracleListenerRunning(databaseEnvironment)) issues.push("OracleサービスまたはListenerが起動していません。");
    if (environment.jdbcProperties && !jdbcPropertiesTargetDatabase(environment.jdbcProperties, database, databaseConfig)) {
      issues.push(`jdbc.properties の接続先が ${database.hostname}:${databaseConfig.listenerPort}:${databaseConfig.serviceName} ではありません。`);
    } else if (!environment.jdbcProperties) {
      issues.push("jdbc.properties がありません。");
    }
    if (sourceResinConfig?.content.match(/jdbc:oracle:thin:@/i)) {
      const resinDatabaseUrl = resinConfig?.content.match(/jdbc:oracle:thin:@[^/\s'"]+/i)?.[0];
      if (!resinDatabaseUrl || !databaseUrlTargetsDatabase(resinDatabaseUrl, database, databaseConfig)) {
        issues.push(`resin.conf のDB接続先が ${database.hostname}:${databaseConfig.listenerPort}:${databaseConfig.serviceName} ではありません。`);
      }
    }
    const sourceDatabase = scenario.assets.servers.find((item) =>
      item.role === "database" && item.stage === "source",
    );
    const requiredSchemas = sourceDatabase
      ? scenario.assets.databases.find((item) => item.serverId === sourceDatabase.id)?.schemas ?? []
      : [];
    const missingSchemas = requiredSchemas.filter((schema) => !databaseEnvironment.databaseSchemas.includes(schema));
    if (missingSchemas.length) {
      issues.push(`DBに必要なスキーマがありません: ${missingSchemas.join(", ")}。`);
    }
    if (allowedInboundPorts && !allowedInboundPorts.includes(databaseConfig.listenerPort)) {
      issues.push(`Security Group が TCP ${databaseConfig.listenerPort} を遮断しています。`);
    }
  }
  return issues;
}

export function getEventLog(
  server: Server,
  scenario: Scenario,
  environment: RuntimeEnvironment,
  environments: RuntimeEnvironments,
  dns: DnsRuntime,
  allowedInboundPorts?: number[],
): Array<{ source: string; type: "Error" | "Warning"; message: string }> {
  if (server.role !== "application" || server.stage !== "target" || dns.address !== server.ipAddress) return [];

  const events: Array<{ source: string; type: "Error" | "Warning"; message: string }> = [];
  if (allowedInboundPorts && !allowedInboundPorts.includes(8080)) {
    events.push({
      source: "AWS Security Group",
      type: "Error",
      message: "インバウンドルールにTCP 8080がなく、利用者からAPへ接続できません。",
    });
  }
  const dnsName = scenario.assets.dns[0]?.name ?? "application";
  const sourceApplication = scenario.assets.servers.find((item) => item.role === "application" && item.stage === "source");
  const serviceIncident = scenario.incidents.find((item) => item.requiredAsset === "service");
  if (!environment.installedSoftware.some((software) => software.toLowerCase().startsWith("java "))) {
    events.push({ source: "Java Runtime", type: "Error", message: "Javaがインストールされていません。" });
  }
  if (!environment.installedSoftware.some((software) => software.toLowerCase().startsWith("resin "))) {
    events.push({ source: "Resin", type: "Error", message: "Resinがインストールされていません。" });
  }
  const requiredServices = scenario.assets.services.filter((item) => item.serverId === sourceApplication?.id);
  for (const service of requiredServices) {
    const targetService = environment.services.find((item) => item.name === service.name);
    if (!targetService || targetService.status !== "running") {
      events.push({
        source: "Service Control Manager",
        type: "Error",
        message: targetService ? `${service.name} service is stopped.` : serviceIncident?.logs[0] ?? `${service.name} service was not found.`,
      });
    }
  }

  const resinConfig = environment.configurationFiles.find((file) => file.name.toLowerCase() === "resin.conf");
  if (!resinConfig?.content.includes(server.ipAddress)) {
    events.push({ source: "Resin", type: "Error", message: `resin.conf の待受アドレスが ${server.ipAddress} ではありません。` });
  }

  const certificateIncident = scenario.incidents.find((item) => item.requiredAsset === "certificate");
  const requiredCertificates = scenario.assets.certificates.filter((item) => item.serverId === sourceApplication?.id && item.hasPrivateKey);
  for (const certificate of requiredCertificates) {
    const targetCertificate = environment.certificates.find((item) => item.id === certificate.id && item.hasPrivateKey);
    if (!targetCertificate && certificate.subject.toLowerCase().includes(dnsName.toLowerCase())) {
      events.push({
        source: "Schannel",
        type: "Error",
        message: certificateIncident?.logs[0] ?? "The TLS certificate private key was not found.",
      });
    }
  }

  const database = scenario.assets.servers.find((item) => item.role === "database" && item.stage === "target");
  const sourceDatabase = scenario.assets.servers.find((item) => item.role === "database" && item.stage === "source");
  const targetDatabaseInfo = database && scenario.assets.databases.find((item) => item.serverId === database.id);
  const targetDatabaseEnvironment = database && environments[database.id];
  if (database && targetDatabaseEnvironment && !oracleListenerRunning(targetDatabaseEnvironment)) {
    events.push({
      source: "Oracle Database",
      type: "Error",
      message: `OracleサービスまたはListenerが ${database.hostname} で起動していません。`,
    });
  }
  if (targetDatabaseInfo && allowedInboundPorts && !allowedInboundPorts.includes(targetDatabaseInfo.listenerPort)) {
    events.push({
      source: "AWS Security Group",
      type: "Error",
      message: `インバウンドルールにTCP ${targetDatabaseInfo.listenerPort}がなく、APからOracle Listenerへ接続できません。`,
    });
  }
  const sourceResinConfig = scenario.assets.configurationFiles.find((file) =>
    file.serverId === sourceApplication?.id && file.name.toLowerCase() === "resin.conf",
  );
  if (sourceResinConfig?.content.match(/jdbc:oracle:thin:@/i) && database && targetDatabaseInfo) {
    const resinDatabaseUrl = resinConfig?.content.match(/jdbc:oracle:thin:@[^/\s'"]+/i)?.[0];
    if (!resinDatabaseUrl || !databaseUrlTargetsDatabase(resinDatabaseUrl, database, targetDatabaseInfo)) {
      events.push({
        source: "Resin",
        type: "Error",
        message: `resin.conf のDB接続先が ${database.hostname}:${targetDatabaseInfo.listenerPort}:${targetDatabaseInfo.serviceName} ではありません。`,
      });
    }
  }
  const requiredSchemas = sourceDatabase
    ? scenario.assets.databases.find((item) => item.serverId === sourceDatabase.id)?.schemas ?? []
    : [];
  const targetSchemas = targetDatabaseEnvironment?.databaseSchemas ?? [];
  const missingSchemas = requiredSchemas.filter((schema) => !targetSchemas.includes(schema));
  if (!database || !targetDatabaseInfo || !environment.jdbcProperties
    || !jdbcPropertiesTargetDatabase(environment.jdbcProperties, database, targetDatabaseInfo)) {
    const jdbcIncident = scenario.incidents.find((item) => item.requiredAsset === "jdbc");
    events.push({
      source: "intra-mart",
      type: "Error",
      message: jdbcIncident?.logs[0] ?? `JDBC connection failed${environment.jdbcProperties ? ` (${environment.jdbcProperties.match(/@([^/\n]+)/)?.[1] ?? "unknown"})` : " (jdbc.properties not found)"}.`,
    });
  }
  if (missingSchemas.length) {
    events.push({
      source: "Oracle Database",
      type: "Error",
      message: `移行先に必要なスキーマがありません: ${missingSchemas.join(", ")}。`,
    });
  }
  const sourceRevision = sourceDatabase ? environments[sourceDatabase.id]?.databaseRevision ?? 0 : 0;
  const targetRevision = database ? environments[database.id]?.databaseRevision ?? 0 : 0;
  if (database && sourceRevision > targetRevision) {
    const dataIncident = scenario.incidents.find((item) => item.requiredAsset === "database-data");
    events.push({
      source: "Oracle Database",
      type: "Error",
      message: dataIncident?.logs[0]
        ? `${dataIncident.logs[0]} (source=${sourceRevision}, target=${targetRevision})`
        : `Database data is stale: source revision ${sourceRevision}, target revision ${targetRevision}.`,
    });
  }

  const requiredTasks = scenario.assets.tasks.filter((task) => task.serverId === sourceApplication?.id);
  const taskIncident = scenario.incidents.find((item) => item.requiredAsset === "task");
  for (const task of requiredTasks) {
    if (!environment.tasks.some((item) => item.name === task.name)) {
      events.push({ source: "TaskScheduler", type: "Warning", message: taskIncident?.logs[0] ?? `The scheduled task ${task.name} was not found.` });
    }
  }

  return events;
}

function findScenarioCommand(command: string, scenario: Scenario): CommandOutput | undefined {
  const normalized = command.toLowerCase().replace(/\s+/g, " ");
  return scenario.commands.find((item) => item.command.toLowerCase() === normalized);
}

function managerForCommand(command: string, server: Server): { app: ManagerApp; displayName: string } | null {
  if ((command === "appwiz.cpl" || command === "servermanager") && server.stage === "target") {
    return { app: "setup", displayName: "プログラムと機能" };
  }
  if (command === "services.msc") return { app: "services", displayName: "Services" };
  if (command === "taskschd.msc") return { app: "tasks", displayName: "Task Scheduler" };
  if (command === "certlm.msc") return { app: "certificates", displayName: "Certificates - Local Computer" };
  if (command === "eventvwr.msc") return { app: "events", displayName: "Event Viewer" };
  if (command === "dnsmgmt.msc" && server.role === "dns") return { app: "dns", displayName: "DNS Manager" };
  if (
    command === "sqlplus" ||
    command === "sqlplus / as sysdba"
  ) {
    return server.role === "database" ? { app: "database", displayName: "SQL*Plus" } : null;
  }
  if (command.startsWith("notepad ") && command.includes("jdbc.properties")) {
    return { app: "notepad", displayName: "Notepad - jdbc.properties" };
  }
  if (command.startsWith("notepad ") && command.includes("resin.conf") && server.role === "application") {
    return { app: "resinConfig", displayName: "Notepad - resin.conf" };
  }
  return null;
}

function systemInfo(server: Server, scenario: Scenario): string[] {
  const vm = scenario.assets.vms.find((item) => item.hostServerId === server.id);
  const build = server.operatingSystem.includes("2019") ? "17763" : "14393";
  return [
    `Host Name:                 ${server.hostname}`,
    `OS Name:                   ${server.operatingSystem} Standard`,
    `OS Version:                10.0.${build} N/A Build ${build}`,
    "System Manufacturer:       Microsoft Corporation",
    `System Type:               x64-based PC`,
    `Processor(s):              ${vm?.vcpu ?? 4} Processor(s) Installed`,
    `Total Physical Memory:     ${vm?.memoryGb ?? 16} GB`,
  ];
}

function ipConfig(server: Server, scenario: Scenario): string[] {
  const dnsServer = scenario.assets.servers.find((item) => item.role === "dns");
  return [
    `Ethernet adapter ${server.role === "dns" ? "Management" : "Production"}:`,
    "",
    "   Connection-specific DNS Suffix  . : example.local",
    `   IPv4 Address. . . . . . . . . . . : ${server.ipAddress}`,
    "   Subnet Mask . . . . . . . . . . . : 255.255.255.0",
    `   Default Gateway . . . . . . . . . : ${server.ipAddress.split(".").slice(0, 3).join(".")}.1`,
    `   DNS Servers . . . . . . . . . . . : ${dnsServer?.ipAddress ?? "10.10.1.10"}`,
  ];
}

function netstat(
  server: Server,
  scenario: Scenario,
  environment: RuntimeEnvironment,
  environments: RuntimeEnvironments,
  allowedInboundPorts?: number[],
): string[] {
  const result = ["Active Connections", "", "  Proto  Local Address          Foreign Address        State"];
  if (server.role === "database") {
    const listenerRunning = oracleListenerRunning(environment);
    const database = scenario.assets.databases.find((item) => item.serverId === server.id);
    if (listenerRunning) {
      result.push(`  TCP    0.0.0.0:${database?.listenerPort ?? 1521}           0.0.0.0:0              LISTENING`);
    }
  } else if (server.role === "dns") {
    result.push("  UDP    0.0.0.0:53             *:*");
  } else {
    const resin = environment.services.some((service) => service.name.toLowerCase().includes("resin") && service.status === "running");
    const hasTls = environment.certificates.some((certificate) => certificate.hasPrivateKey);
    if (resin) result.push("  TCP    0.0.0.0:8080           0.0.0.0:0              LISTENING");
    if (resin && hasTls) result.push("  TCP    0.0.0.0:443            0.0.0.0:0              LISTENING");
    const databaseHost = environment.jdbcProperties?.match(/@([^:/\n]+)/)?.[1];
    const databaseServer = scenario.assets.servers.find((item) => item.hostname.toLowerCase() === databaseHost?.toLowerCase());
    const database = databaseServer && scenario.assets.databases.find((item) => item.serverId === databaseServer.id);
    const databaseEnvironment = databaseServer && environments[databaseServer.id];
    if (
      resin
      && environment.jdbcProperties
      && databaseServer
      && database
      && databaseEnvironment
      && oracleListenerRunning(databaseEnvironment)
      && jdbcPropertiesTargetDatabase(environment.jdbcProperties, databaseServer, database)
      && (!allowedInboundPorts || allowedInboundPorts.includes(database.listenerPort))
    ) {
      result.push(`  TCP    ${server.ipAddress}:53122  ${databaseServer.ipAddress}:${database.listenerPort}      ESTABLISHED`);
    }
  }
  return result;
}

function oracleListenerRunning(environment: RuntimeEnvironment): boolean {
  return Boolean(
    environment.databaseVersion
    && environment.services.some((service) =>
      service.name.toLowerCase().startsWith("oracleservice") && service.status === "running",
    ),
  );
}

function nslookup(host: string | undefined, scenario: Scenario, dns: DnsRuntime): string[] {
  const query = host ?? scenario.assets.dns[0]?.name ?? "";
  const dnsServer = scenario.assets.servers.find((server) => server.role === "dns");
  const targetServer = scenario.assets.servers.find((server) => server.hostname.toLowerCase() === query.toLowerCase());
  const record = scenario.assets.dns.find((item) => item.name.toLowerCase() === query.toLowerCase());
  const address = record ? dns.address : targetServer?.ipAddress;
  if (!address) return [`*** ${dnsServer?.hostname ?? "DNS"} can't find ${query}: Non-existent domain`];
  return [
    `Server:  ${dnsServer?.hostname ?? "DNS"}.example.local`,
    `Address: ${dnsServer?.ipAddress ?? "10.10.1.10"}`,
    "",
    `Name:    ${query}`,
    `Address: ${address}`,
  ];
}

function ping(host: string | undefined, scenario: Scenario, dns: DnsRuntime): string[] {
  if (!host) return ["Usage: ping [-t] [-n count] destination"];
  const server = scenario.assets.servers.find((item) => item.hostname.toLowerCase() === host.toLowerCase());
  const record = scenario.assets.dns.find((item) => item.name.toLowerCase() === host.toLowerCase());
  const address = server?.ipAddress ?? (record ? dns.cachedAddress : undefined);
  if (!address) return [`Ping request could not find host ${host}. Please check the name and try again.`];
  return [
    `Pinging ${host} [${address}] with 32 bytes of data:`,
    `Reply from ${address}: bytes=32 time<1ms TTL=128`,
    "",
    `Ping statistics for ${address}:`,
    "    Packets: Sent = 1, Received = 1, Lost = 0 (0% loss)",
  ];
}

function directoryListing(server: Server, environment: RuntimeEnvironment): string[] {
  const entries = [" Directory of C:\\imart", "", "03/01/2024  08:32 AM    <DIR>          .", "03/01/2024  08:32 AM    <DIR>          .."];
  if ((server.role === "application" && server.stage === "source") || environment.jdbcProperties) {
    entries.push("03/01/2024  08:32 AM               124 jdbc.properties");
  }
  if ((server.role === "application" && server.stage === "source") || environment.services.some((service) => service.name.toLowerCase().includes("resin"))) {
    entries.push("03/01/2024  08:32 AM    <DIR>          resin");
  }
  if (environment.tasks.length > 0) entries.push("03/01/2024  08:32 AM    <DIR>          batch");
  return entries;
}

function serviceQuery(environment: RuntimeEnvironment): string[] {
  if (environment.services.length === 0) return ["SERVICE_NAME: No services found.", "        STATE              : 1  STOPPED"];
  return environment.services.flatMap((service) => [
    `SERVICE_NAME: ${service.name}`,
    `        DISPLAY_NAME: ${service.displayName}`,
    `        STATE              : ${service.status === "running" ? "4  RUNNING" : "1  STOPPED"}`,
    "",
  ]);
}

const helpText = [
  "For more information on a specific command, type HELP command-name",
  "",
  "hostname     systeminfo     ipconfig [/all | /flushdns]",
  "netstat [-ano]     nslookup [host]     ping host     route print",
  "services.msc     taskschd.msc     certlm.msc",
  "appwiz.cpl     (target server software setup)",
  "eventvwr.msc     dnsmgmt.msc     sqlplus / as sysdba",
  "expdp     impdp     lsnrctl status     tnsping alias",
  "java -version     curl http://APSV02:8080/     notepad jdbc.properties",
  "type jdbc.properties",
  "notepad resin.conf     type resin.conf",
  "dir     sc query     cls",
];
