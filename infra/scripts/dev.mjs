import { spawn } from "node:child_process";
import { database } from "./db.mjs";
import { environment, root } from "./env.mjs";
database();
const children = [
  spawn("node", ["infra/scripts/api.mjs"], {
    cwd: root,
    env: environment(),
    stdio: "inherit",
  }),
  spawn("npm", ["run", "dev:web"], {
    cwd: root,
    env: environment(),
    stdio: "inherit",
  }),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill("SIGTERM");
  process.exitCode = code;
}
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => stop());
for (const child of children) child.on("exit", (code) => stop(code ?? 1));
