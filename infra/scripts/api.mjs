import { spawn } from "node:child_process";
import { environment, root } from "./env.mjs";
const env = environment();
env.UPLOAD_DIR ||= root + "data/uploads";
const args = process.argv.includes("--jar")
  ? ["-jar", root + "apps/api/target/wedding-api-1.0.0-SNAPSHOT.jar"]
  : ["-q", "spring-boot:run"];
const child = spawn(process.argv.includes("--jar") ? "java" : "mvn", args, {
  cwd: root + "apps/api",
  env,
  stdio: "inherit",
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code) => process.exit(code ?? 1));
