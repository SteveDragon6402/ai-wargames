import { spawn } from "node:child_process";
import { existsSync, openSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");
const venvPython = resolve(rootDir, ".orpheus-venv/bin/python");
const serverScript = resolve(rootDir, "scripts/orpheus-server.py");
const port = process.env.ORPHEUS_PORT || "5005";
const healthUrl = `http://127.0.0.1:${port}/health`;

async function isRunning() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 600);
    const res = await fetch(healthUrl, { signal: controller.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

async function main() {
  if (await isRunning()) {
    console.log(`[orpheus] Local Orpheus French TTS server already running on http://127.0.0.1:${port}`);
    return;
  }

  if (!existsSync(venvPython) || !existsSync(serverScript)) {
    console.warn("[orpheus] .orpheus-venv not found; skipping local Orpheus daemon.");
    return;
  }

  const logFd = openSync("/tmp/orpheus-tts.log", "a");
  const child = spawn(venvPython, [serverScript], {
    cwd: rootDir,
    detached: true,
    stdio: ["ignore", logFd, logFd],
    env: { ...process.env, ORPHEUS_PORT: String(port) },
  });
  child.unref();
  console.log(`[orpheus] Started local Orpheus French TTS server on http://127.0.0.1:${port} (pid ${child.pid}, logs: /tmp/orpheus-tts.log)`);
}

main().catch((err) => {
  console.warn("[orpheus] Could not start Orpheus server:", err);
});
