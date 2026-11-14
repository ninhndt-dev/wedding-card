const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const origin = process.env.E2E_ORIGIN || "http://127.0.0.1:3101";
if (!["http://127.0.0.1:3100", "http://127.0.0.1:3101"].includes(origin))
  throw Error("Local UI checks only");
(async () => {
  const b = await chromium.launch();
  let release;
  const gate = new Promise((r) => (release = r));
  try {
    const c = await b.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      reducedMotion: "no-preference",
    });
    const source = await (await c.request.get(origin + "/api/content")).json();
    const doc = structuredClone(source);
    const alias = "/media/00000000-0000-4000-8000-000000000001.jpg";
    assert.equal(doc.editor.album.length, 8);
    doc.editor.album[0].src = alias;
    await c.route("**/api/**", (r) => {
      const u = new URL(r.request().url());
      if (u.pathname === "/api/content") return r.fulfill({ json: doc });
      if (u.pathname === "/api/wishes")
        return r.fulfill({ json: { wishes: [] } });
      return r.fulfill({ json: { ok: true } });
    });
    await c.route(
      "**/media/00000000-0000-4000-8000-000000000001.jpg*",
      async (r) => {
        await gate;
        await r.fulfill({
          path: "apps/web/public/thiep-01/icon-tl1.png",
          contentType: "image/png",
        });
      },
    );
    const p = await c.newPage(),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(origin + "/thiep-01/index.html", {
      waitUntil: "domcontentloaded",
    });
    await p
      .locator("#miuBootLoading")
      .waitFor({ state: "hidden", timeout: 45000 });
    await p.locator("#miuOpeningBtn").click();
    await p.locator("#miuOpening").waitFor({ state: "hidden", timeout: 5000 });
    const photos = p.locator("[data-miu-album-item]");
    await photos.first().scrollIntoViewIfNeeded();
    await p.waitForTimeout(1900);
    assert.equal(
      await photos.first().getAttribute("data-reveal-state"),
      "pending",
      "Entrance must wait for the photo instead of finishing on an empty tile",
    );
    release();
    await p.waitForFunction(
      () =>
        document.querySelector("[data-miu-album-item]").dataset.revealState ===
        "running",
    );
    assert.ok(
      await photos
        .first()
        .evaluate((el) => el.getAnimations()[0].currentTime < 800),
    );
    for (let i = 0; i < 8; i++) {
      const photo = photos.nth(i);
      await photo.scrollIntoViewIfNeeded();
      await p.waitForFunction(
        (i) =>
          document.querySelectorAll("[data-miu-album-item]")[i].dataset
            .revealState === "running",
        i,
      );
      const state = await photo.evaluate((el) => ({
        expected: "miu-" + el.dataset.animPreset,
        actual: getComputedStyle(el).animationName,
        decoded:
          el.querySelector("img").complete &&
          el.querySelector("img").naturalWidth > 0,
      }));
      assert.equal(state.actual, state.expected);
      assert.equal(state.decoded, true);
    }
    await p.reload({ waitUntil: "domcontentloaded" });
    await p.locator("#miuBootLoading").waitFor({ state: "hidden" });
    await photos
      .first()
      .evaluate((el) => el.scrollIntoView({ block: "center" }));
    await photos
      .first()
      .locator("img")
      .evaluate((img) => img.decode());
    await p.locator("#miuOpeningBtn").click();
    await p.waitForTimeout(1800);
    assert.equal(
      await photos.first().getAttribute("data-reveal-state"),
      "pending",
      "Restored scroll positions must not spend album motion behind the opening cover",
    );
    await p.locator("#miuOpening").waitFor({ state: "hidden", timeout: 5000 });
    await p.waitForFunction(
      () =>
        document.querySelector("[data-miu-album-item]").dataset.revealState ===
        "running",
    );
    assert.ok(
      await photos
        .first()
        .evaluate((el) => el.getAnimations()[0].currentTime < 800),
    );
    assert.deepEqual(errors, []);
    console.log(
      "Album motion passed: slow images wait for decode and all 8 photos animate when entering view.",
    );
  } finally {
    release?.();
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
