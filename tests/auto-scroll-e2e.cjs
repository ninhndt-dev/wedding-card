const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const origin = process.env.E2E_ORIGIN || "http://127.0.0.1:3101";
if (!/^http:\/\/127\.0\.0\.1:310[01]$/.test(origin)) throw Error("Local checks only");
(async () => {
  const browser = await chromium.launch();
  try {
    for (const mode of ["desktop", "mobile", "reduced"]) {
      const context = await browser.newContext({
        viewport: { width: mode === "desktop" ? 1440 : 390, height: 844 },
        isMobile: mode === "mobile", hasTouch: mode === "mobile",
        reducedMotion: mode === "reduced" ? "reduce" : "no-preference",
      });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", e => errors.push(e.message));
      await page.goto(origin + "/thiep-01/index.html");
      await page.locator("#miuBootLoading").waitFor({ state: "hidden", timeout: 45000 });
      await page.waitForTimeout(1700);
      assert.equal(await page.evaluate(() => scrollY), 0, "No scrolling before opening");
      await page.locator("#miuOpeningBtn").click();
      await page.locator("#miuOpening").waitFor({ state: "hidden", timeout: 8000 });
      if (mode === "reduced") {
        await page.waitForTimeout(3200);
        assert.equal(await page.evaluate(() => scrollY), 0, "Respect reduced motion");
      } else {
        await page.waitForTimeout(700);
        assert.equal(await page.evaluate(() => scrollY), 0, "Give guests time after opening");
        await page.waitForFunction(() => scrollY >= 30, null, { timeout: 8000 });
        if (mode === "mobile") await page.touchscreen.tap(12, 400);
        else await page.mouse.wheel(0, 0);
        const stopped = await page.evaluate(() => scrollY);
        await page.waitForTimeout(700);
        assert.ok(Math.abs(await page.evaluate(() => scrollY) - stopped) <= 1, "User interaction stops scrolling");
        await page.evaluate(() => window.dispatchEvent(new Event("miu:opening:closed")));
        await page.waitForTimeout(1800);
        assert.ok(Math.abs(await page.evaluate(() => scrollY) - stopped) <= 1, "Duplicate opening events do not restart scrolling");
      }
      assert.deepEqual(errors, []);
      await context.close();
      console.log("Auto-scroll passed:", mode);
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
