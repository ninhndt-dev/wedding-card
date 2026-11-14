import { useEffect, useMemo, useState } from "react";
import "./invitations.css";

type Response = Record<string, any>;
type Invitation = {
  id: number;
  token: string;
  name: string;
  phone: string;
  side: string;
  event: string;
  invited_count: number;
  note: string;
  visits: number;
  lastViewed?: string;
  rsvp: Response[];
  wishes: Response[];
  submissions: Response[];
};

function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  text = text.replace(/^\uFEFF/, "");
  const separator = text.match(/^sep=([,;\t])(?:\r\n|\n|\r)/i);
  const delimiter =
    separator?.[1] ||
    [",", ";", "\t"].sort(
      (a, b) =>
        text.split(/\r?\n/, 1)[0].split(b).length -
        text.split(/\r?\n/, 1)[0].split(a).length,
    )[0];
  if (separator) text = text.slice(separator[0].length);
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  if (quoted) throw Error("File CSV có dấu nháy kép chưa đóng.");
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

async function readCsvText(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const encoding =
    bytes[0] === 0xff && bytes[1] === 0xfe
      ? "utf-16le"
      : bytes[0] === 0xfe && bytes[1] === 0xff
        ? "utf-16be"
        : "utf-8";
  return new TextDecoder(encoding).decode(bytes);
}

function importRows(rows: unknown[][]) {
  if (rows.length < 2)
    throw Error("File cần có hàng tiêu đề và ít nhất một khách.");
  const fold = (v: unknown) =>
    String(v ?? "")
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replaceAll("đ", "d")
      .trim()
      .toLowerCase();
  const head = rows[0].map(fold);
  const find = (...terms: string[]) =>
    head.findIndex((h) => terms.some((t) => h.includes(fold(t))));
  const name = find(
    "tên khách",
    "khách mời",
    "họ tên",
    "ho ten",
    "guest name",
    "name",
    "tên người nhận",
    "người nhận",
    "họ và tên",
  );
  if (name < 0) throw Error("Không thấy cột tên khách trong file.");
  const phone = find("điện thoại", "sđt", "phone");
  const side = find(
    "bên mời",
    "khách của",
    "side",
    "nhà trai/nhà gái",
    "loại thiệp",
  );
  const event = find("sự kiện", "event");
  const count = find("số người", "số khách", "invited count");
  const note = find("ghi chú", "note", "lời xưng hô");
  const value = (row: unknown[], index: number) =>
    // Remove the spreadsheet-safety prefix added by our own CSV exporter.
    index < 0
      ? ""
      : String(row[index] ?? "")
          .trim()
          .replace(/^'(?=[=+@\-\t\r])/, "");
  const result = rows
    .slice(1)
    .map((row) => {
      const item: Record<string, string | number> = { name: value(row, name) };
      if (phone >= 0) item.phone = value(row, phone);
      if (side >= 0) item.side = value(row, side);
      if (event >= 0) item.event = value(row, event);
      if (count >= 0) item.invitedCount = Number(value(row, count) || 0);
      if (note >= 0) item.note = value(row, note);
      return item;
    })
    .filter((row) => row.name);
  if (!result.length) throw Error("File không có tên khách hợp lệ.");
  return result;
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return (
    '"' +
    (/^[=+@\-\t\r]/.test(text) ? "'" : "") +
    text.replaceAll('"', '""') +
    '"'
  );
}

function excelCsv(header: unknown[], rows: unknown[][]) {
  const text =
    "\uFEFFsep=;\r\n" +
    [header, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n");
  const bytes = new Uint8Array(text.length * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < text.length; i++)
    view.setUint16(i * 2, text.charCodeAt(i), true);
  return bytes;
}

function household(side: string) {
  const value = side
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  return ["nhagai", "gai", "bride", "codau"].includes(value)
    ? "bride"
    : "groom";
}

export default function InvitationsPage() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [slug, setSlug] = useState("thiep-01");
  const [search, setSearch] = useState("");
  const [sideFilter, setSideFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);
  const [edit, setEdit] = useState<Invitation | null>(null);
  const [newName, setNewName] = useState("");
  const [newSide, setNewSide] = useState("Nhà trai");

  async function load() {
    const [list, content] = await Promise.all([
      fetch("/api/invitations"),
      fetch("/api/content"),
    ]);
    if (list.status === 401) {
      setUnauthorized(true);
      return;
    }
    if (!list.ok)
      throw Error((await list.json()).error || "Không tải được danh sách.");
    setUnauthorized(false);
    setInvitations((await list.json()).invitations);
    if (content.ok) setSlug((await content.json()).site.slug);
  }
  useEffect(() => {
    load().catch((error) => setStatus(error.message));
  }, []);
  const filtered = useMemo(
    () =>
      invitations.filter(
        (item) =>
          (sideFilter === "all" || household(item.side) === sideFilter) &&
          [item.name, item.phone, item.side, item.event]
            .join(" ")
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [invitations, search, sideFilter],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / 20));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * 20;
  const visible = filtered.slice(pageStart, pageStart + 20);
  useEffect(() => {
    setPage(1);
  }, [search, sideFilter]);
  const link = (item: Invitation) =>
    `${location.origin}/i/${slug}/${item.token}`;

  async function upload(file: File) {
    setBusy(true);
    setStatus("Đang đọc file…");
    try {
      let rows: unknown[][];
      if (/\.xlsx$/i.test(file.name)) {
        const { readSheet } = await import("read-excel-file/browser");
        rows = await readSheet(file);
      } else if (/\.csv$/i.test(file.name))
        rows = csvRows(await readCsvText(file));
      else throw Error("Hãy chọn file .csv hoặc .xlsx.");
      const data = importRows(rows);
      const response = await fetch("/api/invitations/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: data }),
      });
      const result = await response.json();
      if (!response.ok)
        throw Error(result.error || "Không nhập được danh sách.");
      await load();
      setStatus(
        `Đã nhập ${result.imported} thiệp. Mỗi dòng được giữ riêng, kể cả trùng tên.`,
      );
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      const response = await fetch("/api/invitations/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: [{ name: newName.trim(), side: newSide }],
        }),
      });
      if (!response.ok)
        throw Error((await response.json()).error || "Không thêm được khách.");
      setNewName("");
      await load();
      setStatus("Đã thêm khách mời.");
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!edit) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/invitations/${edit.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: edit.name,
          phone: edit.phone,
          side: edit.side,
          event: edit.event,
          invitedCount: Number(edit.invited_count),
          note: edit.note,
        }),
      });
      if (!response.ok)
        throw Error((await response.json()).error || "Không lưu được.");
      setEdit(null);
      await load();
      setStatus("Đã lưu thông tin khách.");
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(item: Invitation) {
    if (
      !confirm(
        `Xóa thiệp của ${item.name}? Phản hồi đã gửi vẫn ở trang quản trị chung.`,
      )
    )
      return;
    setBusy(true);
    try {
      const response = await fetch(`/api/invitations/${item.id}`, {
        method: "DELETE",
      });
      if (!response.ok)
        throw Error((await response.json()).error || "Không xóa được.");
      await load();
      setStatus("Đã xóa thiệp cá nhân.");
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function clearAll() {
    if (
      !confirm(
        "Xóa toàn bộ danh sách thiệp? Các link hiện tại sẽ hết hiệu lực. Lời chúc và phản hồi đã gửi vẫn được giữ trong quản trị.",
      )
    )
      return;
    setBusy(true);
    try {
      const response = await fetch("/api/invitations", { method: "DELETE" });
      const result = await response.json();
      if (!response.ok)
        throw Error(result.error || "Không xóa được danh sách.");
      await load();
      setSideFilter("all");
      setSearch("");
      setStatus(
        `Đã xóa ${result.deleted} thiệp. Bạn có thể nhập lại danh sách mới.`,
      );
    } catch (error) {
      setStatus((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function downloadSample() {
    const header = ["Tên khách", "Bên mời"];
    const rows = invitations.length
      ? invitations.map((i) => [i.name, i.side || "Nhà trai"])
      : [
          ["Khách nhà trai", "Nhà trai"],
          ["Khách nhà gái", "Nhà gái"],
        ];
    const blob = new Blob([excelCsv(header, rows)], {
      type: "text/csv;charset=utf-16le",
    });
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = "khach-moi-import.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportList() {
    const header = [
      "Tên khách",
      "Link thiệp",
      "Điện thoại",
      "Bên mời",
      "Sự kiện",
      "Số người được mời",
      "Lượt xem",
      "Lần xem cuối",
      "RSVP",
      "Số người dự",
      "Lời nhắn",
      "Lời chúc",
      "Ghi chú",
    ];
    const rows = invitations.map((i) => [
      i.name,
      link(i),
      i.phone,
      i.side,
      i.event,
      i.invited_count,
      i.visits,
      i.lastViewed || "",
      i.rsvp[0]?.attending || "",
      i.rsvp[0]?.count || 0,
      i.rsvp[0]?.message || "",
      i.wishes[0]?.wish || "",
      i.note,
    ]);
    const blob = new Blob([excelCsv(header, rows)], {
      type: "text/csv;charset=utf-16le",
    });
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = "danh-sach-thiep-khach-moi.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="admin invitation-admin">
      <header>
        <a className="brand" href="/admin">
          NGÀY CHUNG ĐÔI ✧
        </a>
        <a href="/admin">← Quản trị</a>
        <a href="/admin/editor">Chỉnh sửa thiệp</a>
      </header>
      <div className="adminheading">
        <div>
          <p className="eyebrow">THIỆP CÁ NHÂN</p>
          <h1>Danh sách thiệp khách mời</h1>
        </div>
        <strong>{invitations.length} thiệp</strong>
      </div>
      {unauthorized ? (
        <section className="adminpanel">
          <p>Đăng nhập quản trị để xem danh sách khách mời.</p>
          <a className="button" href="/admin">
            Đến trang đăng nhập
          </a>
        </section>
      ) : (
        <>
          <section className="adminpanel invitation-tools">
            <div>
              <h2>Nhập danh sách</h2>
              <button type="button" onClick={downloadSample}>
                Tải CSV để import
              </button>
              <p>
                Chọn file CSV hoặc Excel .xlsx. Cần cột Tên khách; thêm cột Bên
                mời với giá trị Nhà trai hoặc Nhà gái để địa điểm bữa cơm hiển
                thị đúng từng thiệp. Bỏ trống bên mời sẽ dùng Nhà trai. Mỗi dòng
                tạo một thiệp riêng, kể cả trùng tên. Muốn nhập lại từ đầu, hãy
                xóa danh sách cũ trước.
              </p>
            </div>
            <label>
              File khách mời
              <input
                type="file"
                accept=".csv,.xlsx"
                disabled={busy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) upload(file);
                  event.target.value = "";
                }}
              />
            </label>
            <div className="invitation-add">
              <input
                aria-label="Tên khách mới"
                placeholder="Thêm một khách bằng tên"
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
              />
              <select
                aria-label="Bên mời khách mới"
                value={newSide}
                onChange={(e) => setNewSide(e.target.value)}
              >
                <option>Nhà trai</option>
                <option>Nhà gái</option>
              </select>
              <button disabled={busy || !newName.trim()} onClick={create}>
                Thêm khách
              </button>
            </div>
          </section>
          <section className="adminpanel">
            <div className="toolbar">
              <h2>Danh sách</h2>
              <input
                aria-label="Tìm khách"
                placeholder="Tìm tên, số điện thoại, bên mời…"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <button onClick={exportList} disabled={!invitations.length}>
                Xuất CSV ↓
              </button>
              <select
                aria-label="Lọc bên mời"
                value={sideFilter}
                onChange={(e) => setSideFilter(e.target.value)}
              >
                <option value="all">Tất cả bên mời</option>
                <option value="groom">Nhà trai</option>
                <option value="bride">Nhà gái</option>
              </select>
              <small>
                {filtered.length}/{invitations.length} thiệp
              </small>
              <button disabled={busy || !invitations.length} onClick={clearAll}>
                Xóa danh sách thiệp
              </button>
            </div>
            <div className="tablewrap">
              <table>
                <thead>
                  <tr>
                    <th>Khách mời</th>
                    <th>Link thiệp</th>
                    <th>Đã xem</th>
                    <th>RSVP mới nhất</th>
                    <th>Lời chúc / thông tin khách nhập</th>
                    <th>Quản lý</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((item) => {
                    const latest = item.rsvp[0],
                      wish = item.wishes[0],
                      submission = item.submissions[0];
                    return (
                      <tr key={item.id}>
                        <td>
                          <strong>{item.name}</strong>
                          <small>
                            {[item.side || "Nhà trai", item.event, item.phone]
                              .filter(Boolean)
                              .join(" · ")}
                          </small>
                          <small>
                            {item.invited_count > 0
                              ? `Mời tối đa ${item.invited_count} người`
                              : "Chưa đặt giới hạn số người"}
                          </small>
                          {item.note && <small>{item.note}</small>}
                        </td>
                        <td className="invitation-link">
                          <a href={link(item)} target="_blank" rel="noreferrer">
                            Mở thiệp ↗
                          </a>
                          <button
                            onClick={() =>
                              navigator.clipboard
                                .writeText(link(item))
                                .then(() =>
                                  setStatus(
                                    `Đã sao chép link của ${item.name}.`,
                                  ),
                                )
                                .catch(() =>
                                  setStatus(
                                    "Không sao chép được; hãy mở link rồi sao chép từ trình duyệt.",
                                  ),
                                )
                            }
                          >
                            Sao chép link
                          </button>
                        </td>
                        <td>
                          {Number(item.visits) ? (
                            <>
                              <strong>{item.visits} lượt</strong>
                              <small>{item.lastViewed}</small>
                            </>
                          ) : (
                            <span className="badge maybe">Chưa xem</span>
                          )}
                        </td>
                        <td>
                          {latest ? (
                            <>
                              <span className={`badge ${latest.attending}`}>
                                {latest.attending === "yes"
                                  ? "Có dự"
                                  : "Không dự"}
                              </span>
                              <small>
                                {latest.name} · {latest.count} người ·{" "}
                                {latest.event || latest.side || ""}
                              </small>
                              <small>{latest.created}</small>
                              {latest.message && <p>{latest.message}</p>}
                            </>
                          ) : (
                            <span className="badge maybe">Chưa phản hồi</span>
                          )}
                        </td>
                        <td>
                          {wish && (
                            <p>
                              <b>Lời chúc:</b> {wish.wish}
                              <small>
                                {wish.name} · {wish.created}
                              </small>
                            </p>
                          )}
                          {submission && (
                            <p>
                              <b>
                                {submission.kind === "order"
                                  ? "Đặt hàng"
                                  : "Đăng ký"}
                                :
                              </b>{" "}
                              {submission.name}
                              <small>
                                {[submission.phone, submission.email]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </small>
                              {submission.kind === "order" && (
                                <small>
                                  {submission.product} · {submission.quantity} ×
                                  ·{" "}
                                  {Number(submission.total).toLocaleString(
                                    "vi-VN",
                                  )}{" "}
                                  đ
                                </small>
                              )}
                              {submission.note && (
                                <small>{submission.note}</small>
                              )}
                            </p>
                          )}
                          {!wish && !submission && (
                            <span className="muted">Chưa có</span>
                          )}
                        </td>
                        <td>
                          <button onClick={() => setEdit({ ...item })}>
                            Sửa
                          </button>
                          <details>
                            <summary>
                              Lịch sử (
                              {item.rsvp.length +
                                item.wishes.length +
                                item.submissions.length}
                              )
                            </summary>
                            <div className="invitation-history">
                              {item.rsvp.map((r) => (
                                <p key={`r${r.id}`}>
                                  <b>RSVP · {r.created}</b>
                                  <br />
                                  {r.name}:{" "}
                                  {r.attending === "yes"
                                    ? `Có dự (${r.count} người)`
                                    : "Không dự"}{" "}
                                  · {r.event || r.side}
                                  <br />
                                  {r.message}
                                </p>
                              ))}
                              {item.wishes.map((r) => (
                                <p key={`w${r.id}`}>
                                  <b>Lời chúc · {r.created}</b>
                                  <br />
                                  {r.name}: {r.wish}
                                </p>
                              ))}
                              {item.submissions.map((r) => (
                                <p key={`s${r.id}`}>
                                  <b>
                                    {r.kind === "order"
                                      ? "Đặt hàng"
                                      : "Đăng ký"}{" "}
                                    · {r.created}
                                  </b>
                                  <br />
                                  {r.name} · {r.phone} · {r.email}
                                  <br />
                                  {r.kind === "order" && (
                                    <>
                                      {r.product} · {r.quantity} × ·{" "}
                                      {Number(r.total).toLocaleString("vi-VN")}{" "}
                                      đ<br />
                                    </>
                                  )}
                                  {r.note}
                                </p>
                              ))}
                            </div>
                          </details>
                          <button
                            className="danger"
                            onClick={() => remove(item)}
                          >
                            Xóa
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <nav
              className="invitation-pagination"
              aria-label="Phân trang khách mời"
            >
              <span>
                {filtered.length
                  ? `${pageStart + 1}–${Math.min(pageStart + 20, filtered.length)} / ${filtered.length} khách`
                  : "0 khách"}
              </span>
              <button
                disabled={currentPage === 1}
                onClick={() => setPage(currentPage - 1)}
              >
                Trang trước
              </button>
              <label>
                Trang{" "}
                <select
                  aria-label="Chọn trang"
                  value={currentPage}
                  onChange={(event) => setPage(Number(event.target.value))}
                >
                  {Array.from({ length: pageCount }, (_, index) => (
                    <option key={index + 1} value={index + 1}>
                      {index + 1}
                    </option>
                  ))}
                </select>{" "}
                / {pageCount}
              </label>
              <button
                disabled={currentPage === pageCount}
                onClick={() => setPage(currentPage + 1)}
              >
                Trang sau
              </button>
            </nav>
            {!filtered.length && (
              <p className="empty">Chưa có thiệp phù hợp.</p>
            )}
          </section>
          {edit && (
            <div
              className="invitation-modal"
              role="dialog"
              aria-modal="true"
              aria-label="Sửa thông tin thiệp"
            >
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  save();
                }}
              >
                <h2>Sửa thiệp của khách</h2>
                {(
                  [
                    ["name", "Tên khách"],
                    ["phone", "Số điện thoại"],
                    ["event", "Sự kiện"],
                    ["invited_count", "Số người được mời (0 = chưa giới hạn)"],
                    ["note", "Ghi chú"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key}>
                    {label}
                    <input
                      type={key === "invited_count" ? "number" : "text"}
                      min={key === "invited_count" ? 0 : undefined}
                      max={key === "invited_count" ? 50 : undefined}
                      value={edit[key] ?? ""}
                      onChange={(event) =>
                        setEdit({ ...edit, [key]: event.target.value })
                      }
                      required={key === "name"}
                    />
                  </label>
                ))}
                <label>
                  Bên mời
                  <select
                    aria-label="Bên mời"
                    value={edit.side === "Nhà gái" ? "Nhà gái" : "Nhà trai"}
                    onChange={(e) => setEdit({ ...edit, side: e.target.value })}
                  >
                    <option>Nhà trai</option>
                    <option>Nhà gái</option>
                  </select>
                </label>
                <div>
                  <button type="button" onClick={() => setEdit(null)}>
                    Hủy
                  </button>
                  <button className="button" disabled={busy}>
                    Lưu
                  </button>
                </div>
              </form>
            </div>
          )}
        </>
      )}
      <p role="status" className="invitation-status">
        {status}
      </p>
    </main>
  );
}
