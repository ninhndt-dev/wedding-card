import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, openSync } from "node:fs";
import { environment, root } from "./env.mjs";
import { database } from "./db.mjs";
import mysql from "mysql2/promise";
database();
const env = environment();
env.DOCKER_HOST ||= "unix://" + env.HOME + "/.colima/default/docker.sock";
const create = spawnSync(
  "docker",
  [
    "exec",
    "wedding-card-mysql-1",
    "sh",
    "-c",
    `MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot -e "CREATE DATABASE IF NOT EXISTS wedding_card_test CHARACTER SET utf8mb4; GRANT ALL ON wedding_card_test.* TO 'wedding'@'%';"`,
  ],
  { env, stdio: "inherit" },
);
if (create.status !== 0) throw Error("Cannot create test database");
const db = await mysql.createConnection({
  host: env.DB_HOST,
  port: Number(env.DB_PORT),
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: "wedding_card_test",
});
// Only the dedicated test database is reset; production wedding_card is never modified.
try {
  await db.query("SET FOREIGN_KEY_CHECKS=0");
  for (const [table] of (await db.query("SHOW TABLES"))[0].map((row) =>
    Object.values(row),
  )) {
    await db.query("DROP TABLE `" + table + "`");
  }
} finally {
  await db.query("SET FOREIGN_KEY_CHECKS=1");
}
await db.end();
mkdirSync(root + ".local", { recursive: true });
const build = spawnSync("mvn", ["-q", "-f", "apps/api/pom.xml", "package"], {
  cwd: root,
  env,
  stdio: "inherit",
});
if (build.status !== 0) process.exit(build.status ?? 1);
const testEnv = {
  ...env,
  DB_NAME: "wedding_card_test",
  API_PORT: "8087",
  APP_ORIGIN: "http://127.0.0.1:3101",
  API_URL: "http://127.0.0.1:8087",
  UPLOAD_DIR: root + ".local/test-uploads",
  E2E_ORIGIN: "http://127.0.0.1:3101",
};
const api = spawn("node", ["infra/scripts/api.mjs", "--jar"], {
  cwd: root,
  env: testEnv,
  stdio: [
    "ignore",
    openSync(root + ".local/test-api.log", "w"),
    openSync(root + ".local/test-api-error.log", "w"),
  ],
});
const web = spawn(
  "npm",
  ["run", "dev", "-w", "@wedding/web", "--", "--port", "3101"],
  {
    cwd: root,
    env: testEnv,
    stdio: [
      "ignore",
      openSync(root + ".local/test-web.log", "w"),
      openSync(root + ".local/test-web-error.log", "w"),
    ],
  },
);
async function ready(url) {
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw Error("Server not ready: " + url);
}
try {
  await Promise.all([
    ready(testEnv.E2E_ORIGIN + "/api/health"),
    ready(testEnv.E2E_ORIGIN + "/admin"),
  ]);
  for (const file of [
    "tests/spring-e2e.cjs",
    "tests/opening-e2e.cjs",
    "tests/reveal-e2e.cjs",
  ]) {
    const code = await new Promise((resolve) => {
      const child = spawn("node", [file], {
        cwd: root,
        env: testEnv,
        stdio: "inherit",
      });
      child.on("exit", resolve);
    });
    if (code !== 0) {
      process.exitCode = code ?? 1;
      break;
    }
  }
} finally {
  api.kill("SIGTERM");
  web.kill("SIGTERM");
}
