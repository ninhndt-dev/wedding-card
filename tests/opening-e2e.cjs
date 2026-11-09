const { chromium } = require("playwright");
const assert = require("assert/strict");
const fs = require("fs");
(async () => {
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    for (const options of [
      { name: "desktop", viewport: { width: 1440, height: 1000 } },
      {
        name: "mobile",
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
      {
        name: "reduced-motion",
        viewport: { width: 390, height: 844 },
        reducedMotion: "reduce",
      },
    ]) {
      const { name, ...contextOptions } = options;
      const context = await browser.newContext(contextOptions);
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(
        (process.env.E2E_ORIGIN || "http://127.0.0.1:3101") +
          "/thiep-01/index.html",
      );
      await page
        .locator("#miuBootLoading")
        .waitFor({ state: "hidden", timeout: 45000 });
      await page.waitForFunction(() => !!window.weddingOpening);
      const before = await page.locator(".miu-stage").boundingBox();
      await page.evaluate(() => {
        window.__motion = { closed: 0, willClose: 0 };
        addEventListener("miu:opening:closed", () => {
          window.__motion.closed++;
          window.__motion.finished = performance.now();
        });
        addEventListener(
          "miu:opening:willClose",
          () => window.__motion.willClose++,
        );
        window.__motion.started = performance.now();
      });
      await page.locator("#miuOpeningBtn").click();
      await page.locator("#miuOpening").evaluate((el) => {
        for (let i = 0; i < 5; i++) el.click();
        el.querySelector(".miu-env-nutthiep").dispatchEvent(
          new Event("animationend", { bubbles: true }),
        );
      });
      if (name !== "reduced-motion") {
        await page.waitForTimeout(120);
        assert.equal(
          await page.locator("#miuOpening").getAttribute("data-motion"),
          "opening",
        );
        await page.screenshot({
          path: ".local/opening-" + name + "-motion.png",
        });
      }
      await page
        .locator("#miuOpening")
        .waitFor({ state: "hidden", timeout: 3500 });
      const result = await page.evaluate(() => ({
        ...window.__motion,
        overflow: document.documentElement.style.overflow,
        bodyOverflow: document.body.style.overflow,
        aria: document.getElementById("miuOpening").getAttribute("aria-hidden"),
      }));
      const elapsed = Math.round(result.finished - result.started);
      assert.equal(result.closed, 1);
      assert.equal(result.willClose, 1);
      assert.notEqual(result.overflow, "hidden");
      assert.notEqual(result.bodyOverflow, "hidden");
      assert.equal(result.aria, "true");
      assert.ok(
        elapsed < (name === "reduced-motion" ? 600 : 3200),
        String(elapsed),
      );
      if (name !== "reduced-motion") assert.ok(elapsed > 2100, String(elapsed));
      const after = await page.locator(".miu-stage").boundingBox();
      assert.ok(
        Math.abs(before.x - after.x) < 1,
        "Không nhảy ngang khi mở khóa scroll",
      );
      await page.evaluate(() => scrollTo(0, 650));
      assert.ok(await page.evaluate(() => scrollY > 0));
      assert.deepEqual(errors, []);
      results.push({
        name,
        elapsedMs: elapsed,
        onceOnly: true,
        noLayoutJump: true,
        scrollUnlocked: true,
        noJavaScriptErrors: true,
      });
      await context.close();
    }
    console.log(JSON.stringify({ passed: true, results }, null, 2));
    fs.writeFileSync(
      ".local/opening-verification.json",
      JSON.stringify({ passed: true, results }, null, 2),
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
