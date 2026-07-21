import { execFileSync } from "node:child_process";
import path from "node:path";

// Re-seed every REAL state immediately before the run, so no /l token can be stale by the
// time a spec measures it. (A previous run's tokens stopped resolving after ~1.5h against
// the memory store despite a 240-minute TTL — see the report's environment caveat.)
export default function globalSetup() {
  const root = path.resolve(__dirname, "..");
  const out = execFileSync(process.execPath, [path.join(root, "seed-all.mjs")], { cwd: root, encoding: "utf8" });
  process.stdout.write(out);
}
