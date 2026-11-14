const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const origin = process.env.E2E_ORIGIN || "http://127.0.0.1:3101";
if (!["http://127.0.0.1:3100", "http://127.0.0.1:3101"].includes(origin))
  throw Error("Local UI checks only");
(async () => {
  const b = await chromium.launch();
  try {
    const c = await b.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    let wishes = [],
      fail = false;
    await c.route("**/api/**", async (route) => {
      const r = route.request(),
        u = new URL(r.url());
      if (u.pathname === "/api/wishes" && r.method() === "GET")
        return route.fulfill({ json: { wishes } });
      if (u.pathname === "/api/rsvp")
        return route.fulfill({
          status: fail ? 400 : 201,
          json: fail
            ? { error: "Thông báo lỗi dài để kiểm tra bố cục. ".repeat(12) }
            : { ok: true },
        });
      if (r.method() !== "GET")
        return route.fulfill({ status: 200, json: { ok: true } });
      return route.continue();
    });
    const p = await c.newPage(),
      errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    async function open() {
      await p.goto(origin + "/thiep-01/index.html");
      await p
        .locator("#miuBootLoading")
        .waitFor({ state: "hidden", timeout: 45000 });
      await p.locator("#miuOpeningBtn").click();
      await p
        .locator("#miuOpening")
        .waitFor({ state: "hidden", timeout: 5000 });
    }
    async function noOverlap() {
      await p.waitForFunction(() => {
        const r = document
            .querySelector('[data-miu-rsvp="1"]')
            ?.getBoundingClientRect(),
          f = document
            .querySelector('[data-node-id="element_text_5dc9x5olfcf"]')
            ?.getBoundingClientRect();
        const wishes = document
          .querySelector('[data-miu-wishes="1"]')
          .getBoundingClientRect();
        const gift = document
          .querySelector('[data-node-id="element_button_v3c588flfcf"]')
          .getBoundingClientRect();
        const canvas = document.querySelector(".miu-canvas");
        const finalPhoto = document.querySelector(
          '[data-node-id="element_image_o4oxi2kpddq"]',
        );
        return (
          r &&
          f &&
          f.top >= r.bottom + 10 &&
          gift.top >= wishes.bottom + 10 &&
          canvas.offsetHeight >= finalPhoto.offsetTop + finalPhoto.offsetHeight
        );
      });
    }
    async function submit() {
      const f = p.locator('[data-miu-rsvp-form="1"]');
      await f.locator("[name=guestName]").fill("QA UI");
      assert.equal(
        await f.locator("[name=eventName], [name=message]").count(),
        0,
      );
      await f.locator("[type=submit]").click();
      return f;
    }
    await open();
    const list = p.locator('[data-miu-wishes-list="1"]').first();
    assert.equal(await list.isVisible(), false);
    assert.equal(
      await p.getByText("Chưa có lời chúc nào", { exact: true }).count(),
      0,
    );
    const form = await submit();
    await form
      .getByRole("status")
      .filter({ hasText: "Đã lưu xác nhận" })
      .waitFor();
    await noOverlap();
    fail = true;
    await submit();
    await form
      .getByRole("status")
      .filter({ hasText: "Thông báo lỗi dài" })
      .waitFor();
    await noOverlap();
    for (const width of [320, 600]) {
      await p.setViewportSize({ width, height: 844 });
      await noOverlap();
    }
    wishes = Array.from({ length: 5 }, (_, i) => ({
      name: "Khách " + (i + 1),
      wish: "Chúc hai bạn trăm năm hạnh phúc! ".repeat(i + 1),
    }));
    fail = false;
    await open();
    await list.scrollIntoViewIfNeeded();
    await p.mouse.move(0, 0);
    const track = list.locator(".miu-wishes-track");
    await track.waitFor();
    await p.waitForFunction(
      () =>
        document.querySelector(".miu-wishes-ticker")?.dataset.tickerVisible ===
        "true",
    );
    await noOverlap();
    assert.equal(await track.locator(":scope > .miu-wishes-batch").count(), 2);
    const t1 = await track.evaluate((el) => el.getAnimations()[0].currentTime);
    await p.waitForTimeout(250);
    const t2 = await track.evaluate((el) => el.getAnimations()[0].currentTime);
    assert.ok(t2 > t1, "Wishes scroll continuously");
    assert.equal(
      await track.evaluate(
        (el) => getComputedStyle(el).animationTimingFunction,
      ),
      "linear",
    );
    await p.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(
      await track.evaluate((el) => getComputedStyle(el).animationName),
      "none",
    );
    assert.deepEqual(errors, []);
    console.log(
      "Forms passed: empty wishes hidden, continuous linear ticker, reduced motion, RSVP success/error and responsive spacing without overlap.",
    );
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
