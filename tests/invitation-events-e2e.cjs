const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const origin = process.env.E2E_ORIGIN;
if (
  origin !== "http://127.0.0.1:3101" ||
  process.env.DB_NAME !== "wedding_card_test"
)
  throw Error("Use isolated test database");
(async () => {
  const b = await chromium.launch();
  try {
    const c = await b.newContext();
    const post = (path, data) =>
      c.request.post(origin + path, { headers: { Origin: origin }, data });
    assert.equal(
      (
        await post("/api/admin", {
          action: "login",
          password: process.env.ADMIN_PASSWORD,
        })
      ).status(),
      200,
    );
    let state = await (await c.request.get(origin + "/api/editor")).json();
    const doc = structuredClone(state.document);
    doc.events.groom.address = "Địa chỉ nhà trai QA";
    doc.events.bride.address = "Địa chỉ nhà gái QA";
    const eventId = "custom_meal_test_20261127";
    doc.additions = doc.additions.filter((node) => node.id !== eventId);
    doc.additions.push({
      id: eventId,
      type: "event",
      text: "BỮA CƠM THÂN MẬT",
      props: {
        date: "2026-11-27",
        lunar: "(Tức ngày 19 tháng 10 năm Bính Ngọ)",
        groomTime: "18:30",
        brideTime: "17:00",
        groomVenue: "",
        groomAddress: "",
        groomMapUrl: "",
        brideVenue: "",
        brideAddress: "",
        brideMapUrl: "",
      },
      style: {
        left: "0px",
        top: "3608px",
        width: "575px",
        height: "575px",
        zIndex: "10",
      },
    });
    let r = await post("/api/editor", {
      action: "publish",
      revision: state.revision,
      document: doc,
    });
    assert.equal(r.status(), 200, await r.text());
    const p = await c.newPage();
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(origin + "/admin/invitations");
    const imported = p.waitForResponse(
      (r) =>
        r.url() === origin + "/api/invitations/import" &&
        r.request().method() === "POST",
    );
    await p.getByLabel("File khách mời").setInputFiles({
      name: "guests.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        '\uFEFFTên người nhận thiệp,Bên mời,Số người,Điện thoại,Ghi chú\r\n"Anh, chị Nhà Trai",Nhà trai,2,+84901234567,"Ghi chú, có dấu phẩy"\r\nKhách Nhà Gái,Nhà gái,3,0901234567,\r\n',
      ),
    });
    r = await imported;
    assert.equal(r.status(), 200, await r.text());
    assert.equal((await r.json()).imported, 2);
    let list = (await (await c.request.get(origin + "/api/invitations")).json())
      .invitations;
    const groom = list.find((i) => i.name === "Anh, chị Nhà Trai"),
      bride = list.find((i) => i.name === "Khách Nhà Gái");
    assert.ok(groom && bride);
    assert.equal(groom.side, "Nhà trai");
    assert.equal(bride.side, "Nhà gái");
    r = await post("/api/invitations/import", {
      rows: [
        { name: groom.name, side: "Nhà trai" },
        { name: groom.name, side: "Nhà gái" },
      ],
    });
    assert.equal(r.status(), 200);
    assert.equal((await r.json()).imported, 2);
    list = (await (await c.request.get(origin + "/api/invitations")).json())
      .invitations;
    const duplicates = list.filter((row) => row.name === groom.name);
    assert.equal(
      duplicates.length,
      3,
      "Same names, including on the same side, remain separate rows",
    );
    assert.equal(new Set(duplicates.map((row) => row.token)).size, 3);
    await p.reload();
    await p.getByText("Khách Nhà Gái", { exact: true }).first().waitFor();
    const downloading = p.waitForEvent("download");
    await p
      .getByRole("button", { name: "Tải CSV để import", exact: true })
      .click();
    const download = await downloading;
    assert.equal(download.suggestedFilename(), "khach-moi-import.csv");
    const csv = fs.readFileSync(await download.path());
    assert.deepEqual(
      [...csv.subarray(0, 2)],
      [0xff, 0xfe],
      "Excel CSV has an explicit UTF-16 Unicode marker",
    );
    const csvText = csv.subarray(2).toString("utf16le");
    assert.ok(
      csvText.startsWith("sep=;\r\n"),
      "Excel CSV declares its column separator",
    );
    assert.equal(csvText.split("\r\n")[1].split(";").length, 2);
    assert.match(csvText, /Tên khách.*Bên mời/);
    assert.match(csvText, /Anh, chị Nhà Trai/);
    assert.ok(
      !/Link thiệp|Điện thoại|Số người|Sự kiện|Ghi chú/.test(csvText),
      "Import CSV has only guest names and households",
    );
    const reimporting = p.waitForResponse(
      (r) =>
        r.url() === origin + "/api/invitations/import" &&
        r.request().method() === "POST",
    );
    await p.getByLabel("File khách mời").setInputFiles({
      name: "khach-moi-import.csv",
      mimeType: "text/csv",
      buffer: csv,
    });
    assert.equal((await reimporting).status(), 200);
    const roundTrip = (
      await (await c.request.get(origin + "/api/invitations")).json()
    ).invitations;
    assert.equal(
      roundTrip.length,
      list.length * 2,
      "Every imported row creates its own invitation",
    );
    for (const row of list) {
      assert.equal(
        roundTrip.find((i) => i.id === row.id).token,
        row.token,
        "CSV round trip preserves invitation links",
      );
      for (const key of ["phone", "note", "invited_count"])
        assert.equal(
          roundTrip.find((i) => i.id === row.id)[key],
          row[key],
          "CSV round trip preserves " + key,
        );
    }
    await p.reload();
    for (const [side, label] of [
      ["groom", "Nhà trai"],
      ["bride", "Nhà gái"],
    ]) {
      await p.getByLabel("Lọc bên mời").selectOption(side);
      await p.waitForFunction(
        (count) => document.querySelectorAll("tbody tr").length === count,
        roundTrip.filter((i) => i.side === label).length,
      );
      assert.ok(
        (await p.locator("tbody tr td:first-child").allTextContents()).every(
          (t) => t.includes(label),
        ),
      );
    }
    await p.getByLabel("Lọc bên mời").selectOption("all");
    for (const [invite, side, address, time] of [
      [groom, "groom", "Địa chỉ nhà trai QA", "18:30"],
      [bride, "bride", "Địa chỉ nhà gái QA", "17:00"],
    ]) {
      const details = await (
        await c.request.get(origin + "/api/content?invite=" + invite.token)
      ).json();
      assert.equal(details.invitation.side, side);
      assert.deepEqual(Object.keys(details.invitation).sort(), [
        "name",
        "side",
      ]);
      await p.goto(origin + "/i/" + doc.site.slug + "/" + invite.token);
      await p.locator("#miuOpeningBtn").click();
      await p.locator("#miuOpening").waitFor({ state: "hidden" });
      const meal = p.locator('[data-node-id="' + eventId + '"]');
      await meal
        .locator('[data-event-part="address"]')
        .filter({ hasText: address })
        .waitFor();
      assert.equal(await meal.getAttribute("data-invitation-side"), side);
      assert.equal(
        await p
          .locator('[data-node-id="element_text_fdmxouq84o3"]')
          .textContent(),
        side === "bride" ? "LỄ NẠP TÀI" : "LỄ VU QUY",
      );
      assert.equal(
        await p
          .locator('[data-node-id="element_text_fo8she9s3hy"]')
          .textContent(),
        "LỄ THÀNH HÔN",
      );
      assert.match(
        await meal.locator('[data-event-part="calendar"]').textContent(),
        new RegExp(time),
      );
      assert.match(
        await meal.locator('[data-event-part="calendar"]').textContent(),
        /27/,
      );
      assert.equal(
        await meal.locator('[data-event-part="lunar"]').textContent(),
        "(Tức ngày 19 tháng 10 năm Bính Ngọ)",
      );
      assert.equal(
        await p.locator("[data-miu-rsvp-form] [name=eventType]").inputValue(),
        side === "bride" ? "nhagai" : "nhatrai",
      );
    }
    await p.goto(origin + "/admin/editor");
    const frame = p.frameLocator("iframe");
    await frame
      .locator('[data-node-id="' + eventId + '"] [data-event-part="address"]')
      .filter({ hasText: "Địa chỉ nhà trai QA" })
      .waitFor();
    await p.getByLabel("Xem trước bên mời").selectOption("bride");
    await frame
      .locator('[data-node-id="' + eventId + '"] [data-event-part="address"]')
      .filter({ hasText: "Địa chỉ nhà gái QA" })
      .waitFor();
    assert.equal(
      await frame
        .locator('[data-node-id="element_text_fdmxouq84o3"]')
        .textContent(),
      "LỄ NẠP TÀI",
    );
    await p.getByLabel("Xem trước bên mời").selectOption("groom");
    await frame
      .locator('[data-node-id="element_text_fdmxouq84o3"]')
      .filter({ hasText: "LỄ VU QUY" })
      .waitFor();
    r = await c.request.put(origin + "/api/invitations/" + groom.id, {
      headers: { Origin: origin },
      data: {
        name: groom.name,
        side: "nha gai",
        phone: groom.phone,
        event: groom.event,
        note: groom.note,
        invitedCount: groom.invited_count,
      },
    });
    assert.equal(r.status(), 200);
    list = (await (await c.request.get(origin + "/api/invitations")).json())
      .invitations;
    assert.equal(list.find((i) => i.id === groom.id).token, groom.token);
    assert.equal(
      (
        await (
          await c.request.get(origin + "/api/content?invite=" + groom.token)
        ).json()
      ).invitation.side,
      "bride",
    );
    assert.equal(
      (
        await post("/api/invitations/import", {
          rows: [{ name: "Invalid side", side: "other" }],
        })
      ).status(),
      400,
    );
    assert.equal(
      (await c.request.get(origin + "/api/content?invite=invalid")).status(),
      404,
    );
    await p.goto(origin + "/admin/invitations");
    r = await post("/api/invitations/import", {
      rows: Array.from({ length: 25 }, (_, i) => ({
        name: "Trùng tên phân trang",
        side: i % 2 ? "Nhà gái" : "Nhà trai",
      })),
    });
    assert.equal(r.status(), 200);
    list = (await (await c.request.get(origin + "/api/invitations")).json())
      .invitations;
    await p.reload();
    await p.locator("tbody tr").first().waitFor();
    assert.equal(await p.locator("tbody tr").count(), 20);
    await p.getByRole("button", { name: "Trang sau", exact: true }).click();
    assert.equal(await p.locator("tbody tr").count(), list.length - 20);
    await p.getByRole("textbox", { name: /Tìm/ }).fill("Trùng tên phân trang");
    await p.waitForTimeout(100);
    assert.equal(await p.locator("tbody tr").count(), 20);
    await p.getByRole("button", { name: "Trang sau", exact: true }).click();
    assert.equal(await p.locator("tbody tr").count(), 5);
    await p.getByLabel("Lọc bên mời").selectOption("bride");
    await p.waitForTimeout(100);
    assert.equal(await p.locator("tbody tr").count(), 12);
    const deleting = p.waitForResponse(
      (r) =>
        r.url() === origin + "/api/invitations" &&
        r.request().method() === "DELETE",
    );
    p.once("dialog", (dialog) => dialog.accept());
    await p
      .getByRole("button", { name: "Xóa danh sách thiệp", exact: true })
      .click();
    r = await deleting;
    assert.equal(r.status(), 200);
    assert.equal((await r.json()).deleted, list.length);
    assert.equal(
      (await (await c.request.get(origin + "/api/invitations")).json())
        .invitations.length,
      0,
    );
    assert.deepEqual(errors, []);
    console.log(
      "Personal invitations passed: duplicate rows retained, household filters, CSV, personal event details, ID editing and reset.",
    );
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
