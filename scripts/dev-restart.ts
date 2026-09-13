import { execSync, spawn } from "node:child_process";

/**
 * Kill anything listening on 3000/3001, then start `npm run dev`.
 * Windows-first (netstat); safe no-op elsewhere if ports are free.
 */
function killPort(port: number) {
  try {
    if (process.platform === "win32") {
      const out = execSync(
        `netstat -ano | findstr ":${port} " | findstr LISTENING`,
        { encoding: "utf8" },
      );
      const pids = new Set<number>();
      for (const line of out.split(/\r?\n/)) {
        const m = line.trim().match(/\s(\d+)\s*$/);
        if (m) pids.add(Number(m[1]));
      }
      for (const pid of pids) {
        try {
          execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
          console.log(`stopped pid ${pid} on :${port}`);
        } catch {
          /* already gone */
        }
      }
      return;
    }
    execSync(`lsof -ti:${port} | xargs kill -9 2>/dev/null || true`, {
      shell: "/bin/sh",
      stdio: "ignore",
    });
  } catch {
    /* port free */
  }
}

killPort(3000);
killPort(3001);

console.log("Starting dev server on http://localhost:3000 …\n");

const child = spawn("npm", ["run", "dev"], {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

child.on("exit", (code) => process.exit(code ?? 0));
