import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
const [source, destination] = process.argv.slice(2);
if (!source || !destination)
  throw Error(
    "Usage: node infra/scripts/export-sqlite.mjs source.sqlite export.json",
  );
const db = new DatabaseSync(source, { readOnly: true });
const tables = {};
for (const table of [
  "guests",
  "settings",
  "editor_documents",
  "editor_versions",
  "media_assets",
  "editor_presets",
  "visit_events",
  "widget_submissions",
]) {
  const exists = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
    .get(table);
  tables[table] = exists ? db.prepare("SELECT * FROM " + table).all() : [];
}
writeFileSync(
  destination,
  JSON.stringify({
    sourceHash: createHash("sha256")
      .update(JSON.stringify(tables))
      .digest("hex"),
    tables,
  }),
  { mode: 0o600, flag: "wx" },
);
db.close();
console.log("Export completed. Keep the export private.");
