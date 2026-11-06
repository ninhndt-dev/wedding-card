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
    const parallel = await Promise.all([
      post("/api/rsvp", data),
      post("/api/rsvp", data),
    ]);
    assert.deepEqual(parallel.map((x) => x.status()).sort(), [200, 201]);
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
    await form.locator('[name="willAttend"][value="yes"]').check();
    await form.locator('[name="numberOfGuests"]').fill("2");
    await form.locator('[name="eventType"][value="nhagai"]').check();
    await form
      .locator('[name="eventName"]')
      .selectOption({ label: "Tiệc cưới" });
    await form.locator('[name="message"]').fill("Tin nhắn từ trình duyệt");
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
    assert.equal(saved.side, "nhagai");
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
