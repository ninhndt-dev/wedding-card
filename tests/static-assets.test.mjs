import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { versionStaticAssets } from "../infra/scripts/version-static-assets.mjs";

test("static versions cover HTML, imports and fonts without modifying media bytes or API URLs", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "wedding-static-"));
  try {
    await fs.mkdir(path.join(root, "thiep-01"));
    await fs.mkdir(path.join(root, "audio"));
    const song = Buffer.from([0, 1, 2, 3, 255]);
    await fs.writeFile(path.join(root, "audio/music.mp3"), song);
    await fs.writeFile(path.join(root, "thiep-01/font.woff2"), song);
    await fs.writeFile(
      path.join(root, "thiep-01/style.css"),
      "@font-face{src:url('font.woff2')}",
    );
    await fs.writeFile(
      path.join(root, "thiep-01/script.js"),
      "fetch('/api/content');const photo='/media/00000000.jpg';const label='music.mp3';import('./chunk.js');",
    );
    await fs.writeFile(path.join(root, "thiep-01/chunk.js"), "export const value=1;");
    await fs.writeFile(
      path.join(root, "thiep-01/index.html"),
      `<head><script>window.weddingStaticVersion="__STATIC_ASSET_VERSION__"</script><script src="./script.js"></script><link href="./style.css"><audio src="/audio/music.mp3"></audio></head>`,
    );
    const manifest = await versionStaticAssets(root);
    assert.match(manifest.version, /^[a-f0-9]{16}$/);
    assert.ok(!manifest.paths.includes("/thiep-01/index.html"));
    const html = await fs.readFile(
      path.join(root, "thiep-01/index.html"),
      "utf8",
    );
    assert.ok(html.includes(`/thiep-01/script.js?v=${manifest.version}`));
    assert.ok(html.includes(`/audio/music.mp3?v=${manifest.version}`));
    const css = await fs.readFile(
      path.join(root, "thiep-01/style.css"),
      "utf8",
    );
    assert.ok(css.includes(`/thiep-01/font.woff2?v=${manifest.version}`));
    assert.equal(
      await fs.readFile(path.join(root, "thiep-01/script.js"), "utf8"),
      "fetch('/api/content');const photo='/media/00000000.jpg';const label='music.mp3';import('/thiep-01/chunk.js?v=" + manifest.version + "');",
    );
    assert.deepEqual(
      await fs.readFile(path.join(root, "audio/music.mp3")),
      song,
    );
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
