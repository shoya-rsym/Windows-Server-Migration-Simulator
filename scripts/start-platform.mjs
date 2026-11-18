import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { createServer } from "vite";

const host = "127.0.0.1";
const projects = [
  {
    id: "infrastructure",
    name: "Infrastructure Project Simulator",
    root: resolve("apps/infrastructure-project-simulator"),
    port: 5174,
  },
  {
    id: "development",
    name: "Development Project Simulator",
    root: resolve("apps/development-project-simulator"),
    port: 5175,
  },
];
const servers = [];

async function startServer(project, define = {}) {
  const server = await createServer({
    configFile: resolve(project.root, "vite.config.ts"),
    root: project.root,
    define,
    server: { host, port: project.port },
    logLevel: "error",
  });
  await server.listen();
  servers.push(server);

  const address = server.httpServer?.address();
  if (!address || typeof address === "string") {
    throw new Error(`Could not determine the ${project.name} server address.`);
  }

  return `http://${host}:${address.port}`;
}

async function stopServers() {
  await Promise.all(servers.splice(0).map((server) => server.close()));
}

function openBrowser(url) {
  if (process.platform === "win32") {
    const browser = spawn("cmd.exe", ["/c", "start", "", url], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    browser.unref();
    return;
  }

  const command = process.platform === "darwin" ? "open" : "xdg-open";
  const browser = spawn(command, [url], { detached: true, stdio: "ignore" });
  browser.unref();
}

let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  await stopServers();
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

try {
  const simulatorUrls = {};
  for (const project of projects) {
    simulatorUrls[project.id] = await startServer(project);
  }

  const platformUrl = await startServer(
    { name: "Platform Home", root: resolve("apps/platform-home"), port: 5173 },
    { __SIMULATOR_URLS__: JSON.stringify(simulatorUrls) },
  );

  console.log("System Engineer Simulator Platform is ready:");
  console.log(`  TOP: ${platformUrl}`);
  console.log(`  Infrastructure: ${simulatorUrls.infrastructure}`);
  console.log(`  Development: ${simulatorUrls.development}`);
  openBrowser(platformUrl);
} catch (error) {
  await stopServers();
  console.error("Could not start the simulator platform.", error);
  process.exitCode = 1;
}
