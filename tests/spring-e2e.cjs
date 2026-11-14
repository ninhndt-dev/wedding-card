const { chromium } = require("playwright");
const mysql = require("mysql2/promise");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const origin = process.env.E2E_ORIGIN;
if (
  origin !== "http://127.0.0.1:3101" ||
  process.env.DB_NAME !== "wedding_card_test"
)
  throw Error("Run npm test against isolated MySQL test database");
(async () => {
  const db = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1550, height: 1000 },
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const checks = [];
  const post = (url, data) =>
    ctx.request.post(origin + url, { headers: { Origin: origin }, data });
  const state = async () => {
    const r = await ctx.request.get(origin + "/api/editor");
    assert.equal(r.status(), 200);
    return r.json();
  };
  try {
    assert.equal((await ctx.request.get(origin + "/api/health")).status(), 200);
    assert.equal(
      (await ctx.request.get(origin + "/api/health")).headers()[
        "x-wedding-origin"
      ],
      origin,
    );
    const canonicalPage = await ctx.newPage();
    await canonicalPage.route(origin + "/api/health", (route) =>
      route.fulfill({
        status: 200,
        headers: { "X-Wedding-Origin": "https://admin-origin.example" },
        json: { status: "UP" },
      }),
    );
    await canonicalPage.route("https://admin-origin.example/admin", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<p>Canonical admin</p>",
      }),
    );
    await canonicalPage.goto(origin + "/admin");
    await canonicalPage.waitForURL("https://admin-origin.example/admin");
    await canonicalPage.close();
    assert.equal((await ctx.request.get(origin + "/api/editor")).status(), 401);
    assert.equal(
      (
        await ctx.request.post(origin + "/api/admin", {
          data: { action: "login", password: process.env.ADMIN_PASSWORD },
        })
      ).status(),
      403,
    );
    assert.equal((await ctx.request.head(origin + "/api/admin")).status(), 401);
    await page.goto(origin + "/admin/editor");
    await page
      .getByLabel("Mật khẩu", { exact: true })
      .fill(process.env.ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Đăng nhập để chỉnh sửa" }).click();
    await page
      .getByRole("button", { name: "Áp dụng lên thiệp", exact: true })
      .waitFor();
    checks.push("Đăng nhập FE → Spring; cookie HttpOnly và chặn Origin lạ");
    let s = await state();
    assert.equal(s.manifest.nodes.length >= 95, true);
    assert.equal(
      (await db.query("SELECT COUNT(*) n FROM admin_sessions"))[0][0].n,
      1,
    );
    const originalAlbum = structuredClone(s.document.album);
    const preview = page.frameLocator(
      'iframe[title="Xem trước thiệp đang chỉnh"]',
    );
    await preview
      .locator('[data-node-id="element_album_wnivt5llfcf"]')
      .click({ position: { x: 10, y: 10 } });
    const albumPanel = page.locator(".ed-inspector .ed-album-photos");
    await albumPanel.getByLabel("Ảnh album 1", { exact: true }).waitFor();
    const uploadedAlbum = [];
    for (let i = 0; i < 2; i++) {
      const uploadResponse = page.waitForResponse(
        (response) =>
          response.url() === origin + "/api/editor/assets" &&
          response.request().method() === "POST",
      );
      await albumPanel
        .locator('input[type="file"]')
        .nth(i)
        .setInputFiles(path.resolve("apps/web/public/thiep-01/icon-tl1.png"));
      const response = await uploadResponse;
      assert.equal(response.status(), 201, await response.text());
      const asset = (await response.json()).asset;
      uploadedAlbum.push(asset.url);
      await preview
        .locator('[data-miu-album-item] img[data-full-src="' + asset.url + '"]')
        .waitFor();
    }
    // Large camera JPEGs retain their original bytes in storage and when served.
    const largeJpeg = Buffer.from(
      await page.evaluate(() => {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 3000;
        const ctx = canvas.getContext("2d");
        const pixels = ctx.createImageData(canvas.width, canvas.height);
        let seed = 123;
        for (let i = 0; i < pixels.data.length; i += 4) {
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          pixels.data[i] = seed & 255;
          pixels.data[i + 1] = (seed >>> 8) & 255;
          pixels.data[i + 2] = (seed >>> 16) & 255;
          pixels.data[i + 3] = 255;
        }
        ctx.putImageData(pixels, 0, 0);
        return canvas.toDataURL("image/jpeg", 1).split(",")[1];
      }),
      "base64",
    );
    assert.ok(largeJpeg.length > 20 * 1024 * 1024);
    assert.ok(largeJpeg.length < 32 * 1024 * 1024);
    const largeUpload = page.waitForResponse(
      (r) =>
        r.url() === origin + "/api/editor/assets" &&
        r.request().method() === "POST",
    );
    await albumPanel.locator('input[type="file"]').first().setInputFiles({
      name: "large-camera-photo.jpg",
      mimeType: "image/jpeg",
      buffer: largeJpeg,
    });
    const originalResponse = await largeUpload;
    assert.equal(originalResponse.status(), 201);
    await albumPanel
      .getByRole("status", { name: "Trạng thái tải: Ảnh album 1" })
      .filter({ hasText: "giữ nguyên chất lượng" })
      .waitFor();
    const originalAsset = (await state()).assets.find(
      (asset) => asset.original_name === "large-camera-photo.jpg",
    );
    originalAsset.url = "/media/" + originalAsset.filename;
    assert.equal(originalAsset.bytes, largeJpeg.length);
    const servedImage = await ctx.request.get(origin + originalAsset.url);
    assert.equal(servedImage.status(), 200);
    assert.ok(
      (await servedImage.body()).equals(largeJpeg),
      "Served image must match original bytes",
    );
    const [storedImages] = await db.query(
      "SELECT content FROM media_assets WHERE id=?",
      [originalAsset.id],
    );
    assert.ok(
      storedImages[0].content.equals(largeJpeg),
      "Database must preserve original bytes",
    );
    const displayImage = await ctx.request.get(
      origin + originalAsset.url + "?preview=480",
    );
    assert.equal(displayImage.status(), 200);
    assert.equal(displayImage.headers()["vercel-cdn-cache-control"], "public,max-age=31536000,immutable");
    assert.equal(displayImage.headers()["content-type"], "image/jpeg");
    assert.ok(
      (await displayImage.body()).length < largeJpeg.length / 4,
      "Display image should be substantially smaller than the original",
    );
    const [savedPreviews] = await db.query(
      "SELECT content FROM media_previews WHERE filename=? AND size=480",
      [originalAsset.filename],
    );
    assert.equal(savedPreviews.length, 1);
    assert.ok(savedPreviews[0].content.equals(await displayImage.body()));
    assert.equal(
      (
        await ctx.request.get(origin + originalAsset.url + "?preview=123")
      ).status(),
      400,
    );
    uploadedAlbum[0] = originalAsset.url;
    await preview
      .locator(
        '[data-miu-album-item] img[data-full-src="' + originalAsset.url + '"]',
      )
      .waitFor();
    await albumPanel
      .getByRole("status", { name: "Trạng thái tải: Ảnh album 1" })
      .filter({ hasText: "giữ nguyên chất lượng" })
      .waitFor();
    await albumPanel
      .getByLabel("Chú thích ảnh 1", { exact: true })
      .fill("Ảnh đầu đã thay");
    await albumPanel
      .getByRole("button", { name: "Ảnh album 1: Phóng to", exact: true })
      .click();
    await albumPanel
      .getByRole("slider", { name: "Ảnh album 1: Dịch ngang (%)", exact: true })
      .press("ArrowRight");
    await preview
      .locator('[data-miu-album-item] img[style*="scale(1.1)"]')
      .first()
      .waitFor();
    const saveAlbum = page.waitForResponse(
      (response) =>
        response.url() === origin + "/api/editor" &&
        response.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Lưu bản nháp", exact: true })
      .click();
    assert.equal((await saveAlbum).status(), 200);
    const savedAlbum = (await state()).document.album;
    assert.equal(savedAlbum[0].src, uploadedAlbum[0]);
    assert.equal(savedAlbum[1].src, uploadedAlbum[1]);
    assert.equal(savedAlbum[0].caption, "Ảnh đầu đã thay");
    assert.deepEqual(savedAlbum[0].crop, { zoom: 110, x: 1, y: 0 });
    assert.equal(savedAlbum[1].crop, undefined);
    assert.deepEqual(savedAlbum.slice(2), originalAlbum.slice(2));
    await page.reload();
    await page
      .getByRole("button", { name: "Áp dụng lên thiệp", exact: true })
      .waitFor();
    checks.push(
      "Chọn album trên thiệp, upload riêng hai ảnh, preview và lưu lại đúng từng ảnh; giữ nguyên các ảnh khác",
    );
    const triptychId = "element_image_sl7w5g2lfcf";
    const triptych = preview.locator('[data-node-id="' + triptychId + '"]');
    await triptych.click({ position: { x: 10, y: 10 } });
    await page.getByLabel("Ảnh thành phần", { exact: true }).waitFor();
    const backgrounds = triptych.locator('[style*="background-image"]');
    const originalBackgrounds = await backgrounds.evaluateAll((nodes) =>
      nodes.map((node) => ({
        image: node.style.backgroundImage,
        position: node.style.backgroundPosition,
      })),
    );
    assert.equal(originalBackgrounds.length, 3);
    const triptychUpload = page.waitForResponse(
      (r) =>
        r.url() === origin + "/api/editor/assets" &&
        r.request().method() === "POST",
    );
    await page
      .locator('.ed-inspector input[type="file"]')
      .setInputFiles(path.resolve("apps/web/public/thiep-01/icon-tl2.png"));
    const triptychResponse = await triptychUpload;
    assert.equal(triptychResponse.status(), 201);
    const triptychAsset = (await triptychResponse.json()).asset;
    const replacedBackgrounds = triptych.locator(
      '[style*="' + triptychAsset.filename + '"]',
    );
    await replacedBackgrounds.first().waitFor();
    assert.equal(await replacedBackgrounds.count(), 3);
    assert.deepEqual(
      await backgrounds.evaluateAll((nodes) =>
        nodes.map((node) => node.style.backgroundPosition),
      ),
      originalBackgrounds.map((n) => n.position),
    );
    await page.getByTitle("Hoàn tác", { exact: true }).click();
    await replacedBackgrounds.first().waitFor({ state: "hidden" });
    assert.deepEqual(
      await backgrounds.evaluateAll((nodes) =>
        nodes.map((node) => ({
          image: node.style.backgroundImage,
          position: node.style.backgroundPosition,
        })),
      ),
      originalBackgrounds,
    );
    await page
      .getByLabel("Thư viện: Ảnh thành phần", { exact: true })
      .selectOption(triptychAsset.url);
    await replacedBackgrounds.first().waitFor();
    await page
      .getByRole("combobox", { name: "Cách hiển thị ảnh" })
      .selectOption("cover");
    await triptych
      .locator(
        '[style*="background-size: 300%;"], [style*="background-size: auto 100%"]',
      )
      .first()
      .waitFor();
    await page
      .getByRole("button", { name: "Khung trái: Phóng to", exact: true })
      .click();
    const previewFrame = page
      .frames()
      .find((f) => f.url().includes("editorPreview"));
    await previewFrame.waitForFunction(() => {
      const panels = [
        ...document.querySelectorAll(
          '[data-node-id="element_image_sl7w5g2lfcf"] [style]',
        ),
      ].filter((n) => n.style.backgroundImage);
      return (
        Math.abs(
          parseFloat(panels[0].style.backgroundSize) /
            parseFloat(panels[2].style.backgroundSize) -
            1.1,
        ) < 0.001
      );
    });
    const positionsBefore = await backgrounds.evaluateAll((nodes) =>
      nodes.map((n) => n.style.backgroundPosition),
    );
    await page
      .getByRole("slider", { name: "Khung trái: Dịch ngang (%)", exact: true })
      .press("ArrowRight");
    await previewFrame.waitForFunction((before) => {
      const panels = [
        ...document.querySelectorAll(
          '[data-node-id="element_image_sl7w5g2lfcf"] [style]',
        ),
      ].filter((n) => n.style.backgroundImage);
      return (
        panels[0].style.backgroundPosition !== before[0] &&
        panels[1].style.backgroundPosition === before[1] &&
        panels[2].style.backgroundPosition === before[2]
      );
    }, positionsBefore);
    await page.getByRole("button", { name: "Cài đặt", exact: true }).click();
    await page
      .getByRole("button", { name: "Thông tin đôi bạn", exact: true })
      .click();
    await page
      .getByLabel("Tên chú rể", { exact: true })
      .fill("Spring MySQL QA");
    let waiting = page.waitForResponse(
      (r) =>
        r.url() === origin + "/api/editor" && r.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Lưu bản nháp", exact: true })
      .click();
    let r = await waiting;
    assert.equal(r.status(), 200, await r.text());
    s = await state();
    assert.equal(s.document.settings.groom, "Spring MySQL QA");
    assert.equal(s.document.nodes[triptychId].src, triptychAsset.url);
    assert.deepEqual(s.document.nodes[triptychId].panelCrops[0], {
      zoom: 110,
      x: 1,
      y: 0,
    });
    assert.notEqual(
      (await (await ctx.request.get(origin + "/api/content")).json()).groom,
      "Spring MySQL QA",
    );
    const stale = s.revision - 1;
    assert.equal(
      (
        await post("/api/editor", {
          action: "save",
          revision: stale,
          document: s.document,
        })
      ).status(),
      409,
    );
    waiting = page.waitForResponse(
      (r) =>
        r.url() === origin + "/api/editor" && r.request().method() === "POST",
    );
    await page
      .getByRole("button", { name: "Áp dụng lên thiệp", exact: true })
      .click();
    r = await waiting;
    assert.equal(r.status(), 200, await r.text());
    assert.equal(
      (await (await ctx.request.get(origin + "/api/content")).json()).groom,
      "Spring MySQL QA",
    );
    assert.equal(
      (await (await ctx.request.get(origin + "/api/content")).json()).editor
        .nodes[triptychId].src,
      triptychAsset.url,
    );
    assert.equal(
      (await (await ctx.request.get(origin + "/api/content")).json()).editor
        .nodes[triptychId].panelCrops[0].zoom,
      110,
    );
    checks.push(
      "Thay ảnh ghép ba khung bằng upload hoặc thư viện, giữ vị trí khung, hoàn tác và xuất bản đúng ảnh",
    );
    checks.push(
      "Editor lưu nháp, áp dụng, lịch sử và chống ghi đè phiên bản; dữ liệu MySQL",
    );
    let doc = (await state()).document;
    doc.additions.push({
      id: "custom_test_order_1234",
      type: "order",
      text: "Đặt quà",
      props: { product: "Quà QA", unitPrice: 15000, button: "Gửi" },
      style: { top: "100px", left: "10px", width: "300px", height: "200px" },
    });
    s = await state();
    r = await post("/api/editor", {
      action: "publish",
      revision: s.revision,
      document: doc,
    });
    assert.equal(r.status(), 200, await r.text());
    r = await post("/api/submissions", {
      widgetId: "custom_test_order_1234",
      name: "Khách đặt hàng",
      phone: "0900000000",
      email: "qa@example.com",
      quantity: 2,
      total: 1,
      submissionId: "order_test_123456789",
    });
    assert.equal(r.status(), 201, await r.text());
    assert.equal(
      (await db.query("SELECT total FROM widget_submissions"))[0][0].total,
      30000,
    );
    checks.push(
      "Đặt hàng lấy giá đã lưu từ BE, không tin tổng tiền do client gửi",
    );
    const data = {
      guestName: "Khách RSVP QA",
      willAttend: true,
      numberOfGuests: 3,
      eventType: "nhatrai",
      eventName: "Tiệc cưới",
      message: "Lời nhắn riêng",
      submissionId: "rsvp_test_123456789",
    };
    const parallel = await Promise.all(
      Array.from({ length: 8 }, () => post("/api/rsvp", data)),
    );
    const statuses = parallel.map((response) => response.status());
    assert.equal(statuses.filter((status) => status === 201).length, 1);
    assert.equal(statuses.filter((status) => status === 200).length, 7);
    assert.equal(
      (
        await db.query("SELECT COUNT(*) n FROM guests WHERE submission_key=?", [
          data.submissionId,
        ])
      )[0][0].n,
      1,
    );
    assert.equal(
      (await post("/api/rsvp", { ...data, numberOfGuests: 4 })).status(),
      409,
    );
    assert.equal(
      (
        await post("/api/rsvp", { ...data, submissionId: "new_rsvp_123456789" })
      ).status(),
      429,
    );
    assert.equal(
      (await post("/api/rsvp", { ...data, willAttend: "true" })).status(),
      400,
    );
    assert.equal(
      (await post("/api/rsvp", { ...data, numberOfGuests: 51 })).status(),
      400,
    );
    r = await post("/api/rsvp", {
      ...data,
      guestName: "Khách vắng mặt",
      willAttend: false,
      numberOfGuests: 99,
      submissionId: "absent_test_123456789",
    });
    assert.equal(r.status(), 201);
    const absent = (
      await db.query("SELECT `count`,event FROM guests WHERE attending='no'")
    )[0][0];
    assert.equal(absent.count, 0);
    assert.equal(absent.event, "");
    checks.push(
      "RSVP có/không dự, idempotency đồng thời, giới hạn và kiểm tra dữ liệu",
    );
    r = await post("/api/wishes", {
      name: "Lời chúc QA",
      wish: "Chúc hai bạn hạnh phúc <script>bad</script>",
      submissionId: "wish_test_123456789",
    });
    assert.equal(r.status(), 201);
    let wishes = (await (await ctx.request.get(origin + "/api/wishes")).json())
      .wishes;
    assert.equal(wishes.length, 0);
    const wishId = (
      await db.query("SELECT id FROM guests WHERE kind='wish'")
    )[0][0].id;
    assert.equal(
      (
        await post("/api/admin", {
          action: "approve",
          id: wishId,
          approved: true,
        })
      ).status(),
      200,
    );
    wishes = (await (await ctx.request.get(origin + "/api/wishes")).json())
      .wishes;
    assert.equal(wishes.length, 1);
    assert.equal("phone" in wishes[0], false);
    assert.equal("message" in wishes[0], false);
    checks.push(
      "Lời chúc chờ duyệt, duyệt admin và API công khai không lộ RSVP riêng",
    );
    const image = fs.readFileSync(
      path.resolve("apps/web/public/thiep-01/icon-tl1.png"),
    );
    r = await ctx.request.post(origin + "/api/editor/assets", {
      headers: { Origin: origin },
      multipart: {
        file: { name: "qa.png", mimeType: "image/png", buffer: image },
      },
    });
    assert.equal(r.status(), 201, await r.text());
    const asset = (await r.json()).asset;
    assert.equal(
      (await ctx.request.get(origin + asset.url)).headers()["content-type"],
      "image/png",
    );
    r = await ctx.request.post(origin + "/api/editor/assets", {
      headers: { Origin: origin },
      multipart: {
        file: {
          name: "fake.png",
          mimeType: "image/png",
          buffer: Buffer.from('<svg onload="bad()"></svg>'),
        },
      },
    });
    assert.equal(r.status(), 400);
    s = await state();
    s.document.settings.photo = asset.url;
    r = await post("/api/editor", {
      action: "save",
      revision: s.revision,
      document: s.document,
    });
    assert.equal(r.status(), 200, await r.text());
    r = await ctx.request.delete(origin + "/api/editor/assets", {
      headers: { Origin: origin },
      data: { mode: "single", id: asset.id },
    });
    assert.deepEqual((await r.json()).skipped, [asset.id]);
    checks.push(
      "Upload ký hiệu file thật, từ chối SVG giả ảnh, bảo vệ file đang được dùng",
    );
    r = await post("/api/editor/presets", {
      action: "save",
      name: "Preset QA",
      document: (await state()).document,
    });
    assert.equal(r.status(), 201, await r.text());
    const preset = (await r.json()).id;
    assert.equal(
      (
        await ctx.request.get(origin + "/api/editor/presets?id=" + preset)
      ).status(),
      200,
    );
    await post("/api/visits", { visitor: "qa_visitor_1234" });
    let stats = await (
      await ctx.request.get(origin + "/api/editor/stats")
    ).json();
    assert.equal(stats.visits.views >= 1, true);
    assert.equal(stats.rsvp.guests, 3);
    assert.equal(stats.submissions.length, 1);
    checks.push("Preset và thống kê truy vấn MySQL chính xác");
    // Exercise the public RSVP UI, independent from admin API assertions.
    await page.goto(origin + "/thiep-01/index.html");
    await page
      .locator("#miuBootLoading")
      .waitFor({ state: "hidden", timeout: 45000 });
    await page.locator("#miuOpeningBtn").click();
    await page
      .locator("#miuOpening")
      .waitFor({ state: "hidden", timeout: 3000 });
    await page.screenshot({ path: ".local/spring-public.png" });
    checks.push("Thiệp công khai và hiệu ứng mở hoạt động trên Vite");
    const form = page.locator('form[data-miu-rsvp-form="1"]').first();
    await form.locator('[name="guestName"]').fill("Khách gửi từ giao diện");
    await form.locator('[name="numberOfGuests"]').fill("2");
    assert.equal(
      await form
        .locator('[name="eventName"], [name="message"], [type="radio"]')
        .count(),
      0,
    );
    waiting = page.waitForResponse(
      (r) =>
        r.url() === origin + "/api/rsvp" && r.request().method() === "POST",
    );
    await form.locator('button[type="submit"]').click();
    r = await waiting;
    assert.equal(r.status(), 201, await r.text());
    await form
      .getByRole("status")
      .filter({ hasText: "Đã lưu xác nhận" })
      .waitFor();
    const saved = (
      await db.query("SELECT * FROM guests WHERE name=?", [
        "Khách gửi từ giao diện",
      ])
    )[0][0];
    assert.equal(saved.count, 2);
    assert.equal(saved.side, "nhatrai");
    checks.push(
      "Gửi RSVP từ form thiệp → API Spring → MySQL → thông báo thành công",
    );
    const wishForm = page.locator('[data-miu-wishes-form="1"]').first();
    await wishForm.locator('[name="fullname"]').fill("Khách chúc từ giao diện");
    await wishForm.locator('[name="comment"]').fill("Chúc mừng hạnh phúc!");
    waiting = page.waitForResponse(
      (r) =>
        r.url() === origin + "/api/wishes" && r.request().method() === "POST",
    );
    await wishForm.locator('button[type="submit"]').click();
    r = await waiting;
    assert.equal(r.status(), 201, await r.text());
    await wishForm
      .getByRole("status")
      .filter({ hasText: "Đã lưu lời chúc" })
      .waitFor();
    assert.equal(
      (
        await db.query("SELECT approved FROM guests WHERE name=?", [
          "Khách chúc từ giao diện",
        ])
      )[0][0].approved,
      0,
    );
    checks.push("Gửi lời chúc qua giao diện và lưu chờ duyệt trong MySQL");
    await page.goto(origin + "/admin");
    await page.getByRole("heading", { name: "Tổng quan khách mời" }).waitFor();
    assert.equal(
      await page.getByText("Khách RSVP QA", { exact: true }).count(),
      1,
    );
    await page.getByRole("button", { name: "Xuất CSV ↓" }).waitFor();
    checks.push(
      "Dashboard React hiển thị dữ liệu Spring/MySQL và nút xuất CSV",
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(origin + "/admin/editor");
    await page
      .getByRole("button", { name: "Áp dụng lên thiệp", exact: true })
      .waitFor();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
      true,
    );
    assert.deepEqual(errors, []);
    checks.push("Editor mobile 390px và không lỗi JavaScript");
    console.log(JSON.stringify({ passed: true, checks }, null, 2));
    fs.writeFileSync(
      ".local/spring-verification.json",
      JSON.stringify({ passed: true, checks }, null, 2),
    );
  } catch (error) {
    await page
      .screenshot({ path: ".local/spring-failure.png", fullPage: true })
      .catch(() => {});
    throw error;
  } finally {
    await browser.close();
    await db.end();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
