import { spawn } from "node:child_process";
import { environment, root } from "./env.mjs";
const path = process.argv[2];
if (!path)
  throw Error(
    "Usage: node infra/scripts/import-legacy.mjs /absolute/path/export.json",
  );
const child = spawn("node", ["infra/scripts/api.mjs"], {
  cwd: root,
  env: { ...environment(), MIGRATION_FILE: path },
  stdio: "inherit",
});
for (const s of ["SIGINT", "SIGTERM"]) process.on(s, () => child.kill(s));
child.on("exit", (c) => process.exit(c ?? 1));
