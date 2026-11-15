import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const manifestName = "static-asset-manifest.json";

export async function versionStaticAssets(directory) {
  const root = path.resolve(directory);
  async function walk(dir) {
    const result = [];
    for (const item of await fs.readdir(dir, { withFileTypes: true })) {
      const file = path.join(dir, item.name);
      if (item.isDirectory()) result.push(...(await walk(file)));
      else if (item.isFile() && item.name !== manifestName) result.push(file);
    }
    return result;
  }
  const files = (await walk(root)).sort();
  const contents = new Map();
  const hash = crypto.createHash("sha256");
  for (const file of files) {
    const relative = "/" + path.relative(root, file).split(path.sep).join("/");
    const bytes = await fs.readFile(file);
    contents.set(relative, bytes);
    hash.update(relative).update("\0").update(bytes).update("\0");
  }
  const version = hash.digest("hex").slice(0, 16);
  const assets = new Set(
    [...contents.keys()].filter((p) => !/\.html?$/i.test(p)),
  );
  function rewriteUrl(value, current) {
    if (!value || /^(?:data:|https?:|\/\/|#)/i.test(value)) return value;
    try {
      const url = new URL(value, "https://static.invalid" + current);
      if (
        url.origin !== "https://static.invalid" ||
        !assets.has(decodeURIComponent(url.pathname))
      )
        return value;
      url.searchParams.set("v", version);
      return url.pathname + url.search + url.hash;
    } catch {
      return value;
    }
  }
  for (const [relative, bytes] of contents) {
    if (
      !/\.(?:html?|css|js)$/i.test(relative) &&
      !relative.endsWith("/css2(1)")
    )
      continue;
    let text = bytes
      .toString("utf8")
      .replaceAll("__STATIC_ASSET_VERSION__", version);
    // Includes HTML attributes, JS imports and literal static asset URLs.
    text = text.replace(/(["'])([^"'\\\r\n]+)\1/g, (whole, quote, value) =>
      /^(?:\/|\.\/|\.\.\/)/.test(value)
        ? quote + rewriteUrl(value, relative) + quote
        : whole,
    );
    if (/\.html?$/i.test(relative))
      text = text.replace(
        /\b(src|href|poster|data-template-src)=(["'])([^"']+)\2/g,
        (whole, attribute, quote, value) =>
          attribute + "=" + quote + rewriteUrl(value, relative) + quote,
      );
    text = text.replace(
      /url\(\s*(?:(["'])(.*?)\1|([^)]*))\s*\)/g,
      (whole, quote, quoted, bare) =>
        "url(" +
        (quote || "") +
        rewriteUrl((quoted ?? bare).trim(), relative) +
        (quote || "") +
        ")",
    );
    await fs.writeFile(path.join(root, relative.slice(1)), text);
  }
  const manifest = { version, paths: [...assets].sort() };
  await fs.writeFile(path.join(root, manifestName), JSON.stringify(manifest));
  return manifest;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const directory =
    process.argv[2] ||
    fileURLToPath(new URL("../../apps/web/dist", import.meta.url));
  const manifest = await versionStaticAssets(directory);
  console.log(
    `Versioned ${manifest.paths.length} static assets (${manifest.version})`,
  );
}
