import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { environment, root } from "./env.mjs";
export function database(action = "up") {
  const env = environment();
  const colima = env.HOME + "/.colima/default/docker.sock";
  if (!env.DOCKER_HOST && existsSync(colima))
    env.DOCKER_HOST = "unix://" + colima;
  // Public image pulls do not require the stale Docker Desktop credential helper.
  if (!env.DOCKER_CONFIG) {
    mkdirSync(root + ".local/docker-config", { recursive: true });
    env.DOCKER_CONFIG = root + ".local/docker-config";
  }
  const probe = spawnSync("docker", ["compose", "version"], {
    env,
    stdio: "ignore",
  });
  const command = probe.status === 0 ? "docker" : "docker-compose";
  const args = [
    ...(probe.status === 0 ? ["compose"] : []),
    "--env-file",
    root + ".env.local",
    "-f",
    root + "infra/compose.yaml",
    ...(action === "up" ? ["up", "-d", "--wait", "mysql"] : ["down"]),
  ];
  const result = spawnSync(command, args, { env, cwd: root, stdio: "inherit" });
  if (result.status !== 0)
    throw Error("Không khởi động được MySQL. Hãy bật Docker hoặc Colima.");
}
if (process.argv[1]?.endsWith("/db.mjs")) database(process.argv[2]);
