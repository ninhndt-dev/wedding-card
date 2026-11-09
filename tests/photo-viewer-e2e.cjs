const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const origin = process.env.E2E_ORIGIN || "http://127.0.0.1:3101";
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    const page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(origin + "/thiep-01/index.html");
    await page
      .locator("#miuBootLoading")
      .waitFor({ state: "hidden", timeout: 45000 });
    await page.locator("#miuOpeningBtn").click();
    await page
      .locator("#miuOpening")
      .waitFor({ state: "hidden", timeout: 3500 });
    const hero = page.locator('[data-node-id="element_image_az87tzsrjz9"] img');
    const heroSrc = await hero.getAttribute("src");
    await hero.click({ position: { x: 50, y: 60 } });
    const viewer = page.getByRole("dialog", { name: "Xem ảnh phóng lớn" }),
      photo = viewer.locator(".photo-image");
    await viewer.waitFor();
    await photo.evaluate((img) => img.decode());
    assert.equal(
      await photo.getAttribute("src"),
      new URL(heroSrc, origin + "/thiep-01/index.html").href,
    );
    const dims = await photo.evaluate((img) => ({
      w: img.getBoundingClientRect().width,
      h: img.getBoundingClientRect().height,
      nw: img.naturalWidth,
      nh: img.naturalHeight,
      fit: getComputedStyle(img).objectFit,
    }));
    assert.equal(dims.fit, "contain");
    assert.ok(Math.abs(dims.w / dims.h - dims.nw / dims.nh) < 0.01);
    assert.equal(
      await viewer.locator("[data-photo-original]").getAttribute("href"),
      await photo.getAttribute("src"),
    );
    await viewer
      .getByRole("button", { name: "Xem ảnh ở kích thước gốc" })
      .click();
    assert.equal(
      await viewer.evaluate((d) => d.classList.contains("is-zoomed")),
      true,
    );
    assert.equal(
      await photo.evaluate((img) =>
        Math.round(img.getBoundingClientRect().width),
      ),
      await photo.evaluate((img) => img.naturalWidth),
    );
    await viewer.getByRole("button", { name: "Thu ảnh vừa màn hình" }).click();
    const first = await photo.getAttribute("src");
    await page.keyboard.press("ArrowRight");
    assert.notEqual(await photo.getAttribute("src"), first);
    await page.keyboard.press("ArrowLeft");
    assert.equal(await photo.getAttribute("src"), first);
    await page.keyboard.press("Escape");
    await viewer.waitFor({ state: "hidden" });
    assert.notEqual(
      await page.evaluate(() => document.documentElement.style.overflow),
      "hidden",
    );
    // Every eligible image, including decorations and album images, opens its original source.
    const images = page.locator('.miu-canvas img[data-photo-view="1"]');
    const total = await images.count();
    assert.ok(total > 10);
    for (let i = 0; i < total; i++) {
      const target = images.nth(i);
      const expected = await target.evaluate(
        (img) =>
          new URL(
            img.closest("[data-miu-album-item]")?.dataset.src ||
              img.currentSrc ||
              img.src,
            location.href,
          ).href,
      );
      await target.evaluate((img) => img.click());
      await viewer.waitFor();
      assert.equal(await photo.getAttribute("src"), expected, "Image " + i);
      await viewer
        .getByRole("button", { name: "Đóng ảnh", exact: true })
        .click();
      await viewer.waitFor({ state: "hidden" });
    }
    const album = page.locator("[data-miu-album-item]").first();
    await album.scrollIntoViewIfNeeded();
    await album.click();
    await viewer.waitFor();
    assert.equal(
      await page.locator("#miuAlbumModal:visible").count(),
      0,
      "No duplicate legacy album modal",
    );
    await viewer.getByRole("button", { name: "Ảnh tiếp theo" }).click();
    await viewer.getByRole("button", { name: "Ảnh trước" }).click();
    await page.keyboard.press("Escape");
    await hero.focus();
    await page.keyboard.press("Enter");
    await viewer.waitFor();
    await page.keyboard.press("Escape");
    const response = await context.request.post(origin + "/api/admin", {
      headers: { Origin: origin },
      data: { action: "login", password: process.env.ADMIN_PASSWORD },
    });
    assert.equal(response.status(), 200);
    const current = await (
      await context.request.get(origin + "/api/editor")
    ).json();
    const uploaded = current.assets.find((asset) =>
      asset.mime.startsWith("image/"),
    );
    assert.ok(uploaded);
    const uploadedSrc = uploaded.url || "/media/" + uploaded.filename;
    const updated = structuredClone(current.published);
    updated.additions.push({
      id: "custom_uploaded_photo_1234",
      type: "image",
      src: uploadedSrc,
      text: "Ảnh tải lên",
      props: {},
      style: {
        top: "1400px",
        left: "20px",
        width: "300px",
        height: "250px",
        zIndex: "99",
      },
    });
    updated.additions.push({
      id: "custom_added_album_1234",
      type: "album",
      text: "Album mới",
      props: { images: [uploadedSrc, updated.album[0].src] },
      style: {
        top: "1800px",
        left: "20px",
        width: "300px",
        height: "400px",
        zIndex: "99",
      },
    });
    const publish = await context.request.post(origin + "/api/editor", {
      headers: { Origin: origin },
      data: {
        action: "publish",
        revision: current.revision,
        document: updated,
      },
    });
    assert.equal(publish.status(), 200, await publish.text());
    await page.reload();
    await page
      .locator("#miuBootLoading")
      .waitFor({ state: "hidden", timeout: 45000 });
    await page.locator("#miuOpeningBtn").click();
    await page
      .locator("#miuOpening")
      .waitFor({ state: "hidden", timeout: 3500 });
    await page
      .locator('[data-node-id="custom_uploaded_photo_1234"] img')
      .click();
    await viewer.waitFor();
    assert.equal(
      await photo.getAttribute("src"),
      new URL(uploadedSrc, origin).href,
    );
    await page.keyboard.press("Escape");
    await page
      .locator('[data-node-id="custom_added_album_1234"] .ww-album a')
      .first()
      .click();
    await viewer.waitFor();
    assert.equal(
      await photo.getAttribute("src"),
      new URL(uploadedSrc, origin).href,
    );
    assert.equal(
      context.pages().length,
      1,
      "Added albums open the viewer rather than a separate browser tab",
    );
    await page.keyboard.press("Escape");
    await page.goto(origin + "/admin/editor");
    await page
      .getByRole("button", { name: "Áp dụng lên thiệp", exact: true })
      .waitFor();
    const frame = page.frameLocator(
      'iframe[title="Xem trước thiệp đang chỉnh"]',
    );
    await frame
      .locator("html[data-editor-interactive]")
      .waitFor({ state: "attached" });
    await frame
      .locator('[data-node-id="element_image_az87tzsrjz9"] img')
      .click({ position: { x: 50, y: 60 } });
    await page
      .locator(".ed-inspector .ed-node-id")
      .filter({ hasText: "element_image_az87tzsrjz9" })
      .waitFor();
    assert.equal(
      await frame.locator("#weddingPhotoViewer[open]").count(),
      0,
      "Editing selects the image rather than opening the viewer",
    );
    assert.deepEqual(errors, []);
    await context.close();
    const mobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const p = await mobile.newPage();
    await p.goto(origin + "/thiep-01/index.html");
    await p
      .locator("#miuBootLoading")
      .waitFor({ state: "hidden", timeout: 45000 });
    await p.locator("#miuOpeningBtn").click();
    await p.locator("#miuOpening").waitFor({ state: "hidden", timeout: 3500 });
    await p
      .locator('[data-node-id="element_image_az87tzsrjz9"] img')
      .tap({ position: { x: 50, y: 60 } });
    const modal = p.locator("#weddingPhotoViewer");
    await modal.waitFor();
    assert.equal(
      await p.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    const before = await modal.locator(".photo-image").getAttribute("src");
    await modal.locator(".photo-viewport").dispatchEvent("pointerdown", {
      pointerType: "touch",
      clientX: 300,
      clientY: 350,
    });
    await modal.locator(".photo-viewport").dispatchEvent("pointerup", {
      pointerType: "touch",
      clientX: 80,
      clientY: 355,
    });
    assert.notEqual(
      await modal.locator(".photo-image").getAttribute("src"),
      before,
    );
    await p.screenshot({ path: ".local/photo-viewer-mobile.png" });
    await modal.getByRole("button", { name: "Đóng ảnh", exact: true }).tap();
    await modal.waitFor({ state: "hidden" });
    await mobile.close();
    console.log(
      "Photo viewer passed: " +
        total +
        " images, original source, uncropped fit, native-size zoom, arrows, keyboard, mobile swipe, scroll unlock and editor selection.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
