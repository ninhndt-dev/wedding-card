import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
export const root = fileURLToPath(new URL("../../", import.meta.url));
export function environment() {
  const result = { ...process.env };
  if (existsSync(root + ".env.local"))
    for (const line of readFileSync(root + ".env.local", "utf8").split(
      /\r?\n/,
    )) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m && !Object.hasOwn(result, m[1]))
        result[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
    }
  return result;
}
