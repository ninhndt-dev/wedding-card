const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const expected = require("./fixtures/invitation-motion.json");
const origin = process.env.E2E_ORIGIN || "http://127.0.0.1:3101";
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 494, height: 1058 },
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(origin + "/thiep-01/index.html");
    await page
      .locator("#miuBootLoading")
      .waitFor({ state: "hidden", timeout: 45000 });
    await page.waitForFunction(() => !!window.weddingReveal);
    const alignment = await page.evaluate(() => ({
      paper: document.getElementById("miuOpeningSides").getBoundingClientRect()
        .x,
      canvas: document.querySelector(".miu-stage").getBoundingClientRect().x,
    }));
    assert.ok(
      Math.abs(alignment.paper - alignment.canvas) < 1,
      "The paper must cover the invitation without a visible photo strip.",
    );
    const metadata = await page
      .locator("[data-anim-preset]")
      .evaluateAll((elements) =>
        elements.map((el) =>
          Object.fromEntries(
            [...el.attributes]
              .filter(
                (a) =>
                  a.name === "data-node-id" || a.name.startsWith("data-anim-"),
              )
              .map((a) => [a.name, a.value]),
          ),
        ),
      );
    assert.deepEqual(
      metadata,
      expected,
      "Keep every entrance preset, duration, delay, distance and easing from the reference.",
    );
    const album = page.locator('[data-node-id="element_album_wnivt5llfcf"]');
    assert.equal(await album.getAttribute("data-reveal-state"), "pending");
    const photos = album.locator("[data-miu-album-item]");
    assert.equal(await photos.count(), 8);
    assert.equal(
      await photos.first().getAttribute("data-reveal-state"),
      "pending",
    );
    assert.equal(
      await photos.first().evaluate((el) => getComputedStyle(el).opacity),
      "0",
    );
    await page.locator("#miuOpeningBtn").click();
    await page
      .locator("#miuOpening")
      .waitFor({ state: "hidden", timeout: 3500 });
    const animated = [
      ["element_image_cp2ifiqq6p5", "miu-rotateInDownLeft", "0.8s"],
      ["element_image_uowcu8ia0qk", "miu-rotateInDownRight", "0.8s"],
      ["element_calendar_5zjnlsxup6d", "miu-fadeInDown", "3s"],
      ["element_image_s613twtlfcd", "miu-flipInX", "3s"],
    ];
    for (const [id, name, duration] of animated) {
      const node = page.locator('[data-node-id="' + id + '"]');
      await node.scrollIntoViewIfNeeded();
      await page.waitForFunction(
        (id) =>
          document.querySelector('[data-node-id="' + id + '"]').dataset
            .revealState === "running",
        id,
      );
      const actual = await node.evaluate((el) => ({
        name: getComputedStyle(el).animationName,
        duration: getComputedStyle(el).animationDuration,
      }));
      assert.equal(actual.name, name);
      assert.equal(actual.duration, duration);
    }
    await photos.first().scrollIntoViewIfNeeded();
    await page.waitForFunction(
      () =>
        document.querySelector("[data-miu-album-item]").dataset.revealState ===
        "running",
    );
    assert.equal(
      await photos.first().evaluate((el) => getComputedStyle(el).animationName),
      "miu-fadeInLeft",
    );
    assert.equal(
      await photos
        .first()
        .evaluate((el) => getComputedStyle(el).animationDuration),
      "1.6s",
    );
    const symbols = await page.locator(".snowflake").allTextContents();
    assert.deepEqual(symbols, [
      "♥️",
      "❅",
      "♥️",
      "❅",
      "♥️",
      "♥️",
      "❤",
      "❤",
      "❤",
      "❤",
    ]);
    assert.equal(await page.locator(".snowflakes").isVisible(), true);
    await page.screenshot({ path: ".local/video-reference/current-album.png" });
    assert.deepEqual(errors, []);
    await context.close();
    const reduced = await browser.newContext({
      viewport: { width: 390, height: 844 },
      reducedMotion: "reduce",
    });
    const reducedPage = await reduced.newPage();
    await reducedPage.goto(origin + "/thiep-01/index.html");
    await reducedPage.waitForFunction(
      () =>
        !!window.weddingReveal &&
        document.documentElement.dataset.contentLoaded === "true",
    );
    assert.equal(
      await reducedPage.locator('[data-reveal-state="pending"]').count(),
      0,
    );
    assert.equal(await reducedPage.locator(".snowflakes").isVisible(), false);
    await reduced.close();
    const editing = await browser.newContext({
      viewport: { width: 1550, height: 1000 },
    });
    const login = await editing.request.post(origin + "/api/admin", {
      headers: { Origin: origin },
      data: { action: "login", password: process.env.ADMIN_PASSWORD },
    });
    assert.equal(login.status(), 200);
    const editor = await editing.newPage();
    editor.on("pageerror", (e) => errors.push(e.message));
    await editor.goto(origin + "/admin/editor");
    await editor
      .getByRole("button", { name: "Áp dụng lên thiệp", exact: true })
      .waitFor();
    const preview = editor.frameLocator(
      'iframe[title="Xem trước thiệp đang chỉnh"]',
    );
    await preview
      .locator("html[data-editor-interactive]")
      .waitFor({ state: "attached" });
    await editor.evaluate(() =>
      document
        .querySelector("iframe")
        .contentWindow.postMessage(
          { source: "wedding-editor", type: "opening" },
          location.origin,
        ),
    );
    await preview.locator("#miuOpeningBtn").click();
    await preview
      .locator("#miuOpening")
      .waitFor({ state: "hidden", timeout: 3500 });
    assert.equal(
      await preview.locator('[data-reveal-state="pending"]').count(),
      0,
    );
    assert.deepEqual(errors, []);
    await editing.close();
    console.log(
      "Reference motion passed: all entrance metadata, scroll reveals, cloned album entrances, particle mix and reduced motion.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
