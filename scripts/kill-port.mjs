import { execSync } from "node:child_process";

const port = process.argv[2];
if (!port) process.exit(0);

try {
  const pids = execSync(`lsof -ti:${port}`, { encoding: "utf8" })
    .trim()
    .split("\n")
    .filter(Boolean);
  for (const pid of pids) {
    try {
      process.kill(Number(pid), "SIGTERM");
    } catch {
      /* already gone */
    }
  }
} catch {
  /* nothing listening */
}
