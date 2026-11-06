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
  let row: string[] = [], cell = "", quoted = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (char === "," && !quoted) { row.push(cell); cell = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); if (row.some((value) => value.trim())) rows.push(row);
      row = []; cell = "";
    } else cell += char;
  }
  if (quoted) throw Error("File CSV có dấu nháy kép chưa đóng.");
  row.push(cell); if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function importRows(rows: unknown[][]) {
  if (rows.length < 2) throw Error("File cần có hàng tiêu đề và ít nhất một khách.");
  const head = rows[0].map((v) => String(v ?? "").trim().toLowerCase());
  const find = (...terms: string[]) => head.findIndex((h) => terms.some((t) => h.includes(t)));
  const name = find("tên khách", "khách mời", "họ tên", "ho ten", "guest name", "name");
  if (name < 0) throw Error("Không thấy cột tên khách trong file.");
  const phone = find("điện thoại", "sđt", "phone");
  const side = find("bên mời", "khách của", "side");
  const event = find("sự kiện", "event");
  const count = find("số người", "số khách", "invited count");
  const note = find("ghi chú", "note", "lời xưng hô");
  const value = (row: unknown[], index: number) => index < 0 ? "" : String(row[index] ?? "").trim();
  const result = rows.slice(1).map((row) => {
    const item: Record<string, string | number> = { name: value(row, name) };
    if (phone >= 0) item.phone = value(row, phone);
    if (side >= 0) item.side = value(row, side);
    if (event >= 0) item.event = value(row, event);
    if (count >= 0) item.invitedCount = Number(value(row, count) || 0);
    if (note >= 0) item.note = value(row, note);
    return item;
  }).filter((row) => row.name);
  if (!result.length) throw Error("File không có tên khách hợp lệ.");
  return result;
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return '"' + (/^[=+@\-\t\r]/.test(text) ? "'" : "") + text.replaceAll('"', '""') + '"';
}

export default function InvitationsPage() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [slug, setSlug] = useState("thiep-01");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [unauthorized, setUnauthorized] = useState(false);
  const [edit, setEdit] = useState<Invitation | null>(null);
  const [newName, setNewName] = useState("");

  async function load() {
    const [list, content] = await Promise.all([fetch("/api/invitations"), fetch("/api/content")]);
    if (list.status === 401) { setUnauthorized(true); return; }
    if (!list.ok) throw Error((await list.json()).error || "Không tải được danh sách.");
    setUnauthorized(false);
    setInvitations((await list.json()).invitations);
    if (content.ok) setSlug((await content.json()).site.slug);
  }
  useEffect(() => { load().catch((error) => setStatus(error.message)); }, []);
  const filtered = useMemo(() => invitations.filter((item) =>
    [item.name, item.phone, item.side, item.event].join(" ").toLowerCase().includes(search.toLowerCase())),
    [invitations, search]);
  const link = (item: Invitation) => `${location.origin}/i/${slug}/${item.token}`;

  async function upload(file: File) {
    setBusy(true); setStatus("Đang đọc file…");
    try {
      let rows: unknown[][];
      if (/\.xlsx$/i.test(file.name)) {
        const { readSheet } = await import("read-excel-file/browser");
        rows = await readSheet(file);
      } else if (/\.csv$/i.test(file.name)) rows = csvRows(await file.text());
      else throw Error("Hãy chọn file .csv hoặc .xlsx.");
      const data = importRows(rows);
      const response = await fetch("/api/invitations/import", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: data }),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error || "Không nhập được danh sách.");
      await load();
      setStatus(`Đã nhập ${result.imported} thiệp; bỏ ${result.duplicates} dòng trùng tên, giữ dòng cuối.`);
    } catch (error) { setStatus((error as Error).message); }
    finally { setBusy(false); }
  }

  async function create() {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      const response = await fetch("/api/invitations/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows: [{ name: newName.trim() }] }) });
      if (!response.ok) throw Error((await response.json()).error || "Không thêm được khách.");
      setNewName(""); await load(); setStatus("Đã thêm khách mời.");
    } catch (error) { setStatus((error as Error).message); }
    finally { setBusy(false); }
  }

  async function save() {
    if (!edit) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/invitations/${edit.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        name: edit.name, phone: edit.phone, side: edit.side, event: edit.event,
        invitedCount: Number(edit.invited_count), note: edit.note,
      }) });
      if (!response.ok) throw Error((await response.json()).error || "Không lưu được.");
      setEdit(null); await load(); setStatus("Đã lưu thông tin khách.");
    } catch (error) { setStatus((error as Error).message); }
    finally { setBusy(false); }
  }

  async function remove(item: Invitation) {
    if (!confirm(`Xóa thiệp của ${item.name}? Phản hồi đã gửi vẫn ở trang quản trị chung.`)) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/invitations/${item.id}`, { method: "DELETE" });
      if (!response.ok) throw Error((await response.json()).error || "Không xóa được.");
      await load(); setStatus("Đã xóa thiệp cá nhân.");
    } catch (error) { setStatus((error as Error).message); }
    finally { setBusy(false); }
  }

  function exportList() {
    const header = ["Tên khách", "Link thiệp", "Điện thoại", "Bên mời", "Sự kiện", "Số người được mời", "Lượt xem", "Lần xem cuối", "RSVP", "Số người dự", "Lời nhắn", "Lời chúc", "Ghi chú"];
    const rows = invitations.map((i) => [i.name, link(i), i.phone, i.side, i.event, i.invited_count, i.visits, i.lastViewed || "", i.rsvp[0]?.attending || "", i.rsvp[0]?.count || 0, i.rsvp[0]?.message || "", i.wishes[0]?.wish || "", i.note]);
    const blob = new Blob(["\uFEFF" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url; a.download = "danh-sach-thiep-khach-moi.csv"; a.click(); URL.revokeObjectURL(url);
  }

  return <main className="admin invitation-admin">
    <header><a className="brand" href="/admin">NGÀY CHUNG ĐÔI ✧</a><a href="/admin">← Quản trị</a><a href="/admin/editor">Chỉnh sửa thiệp</a></header>
    <div className="adminheading"><div><p className="eyebrow">THIỆP CÁ NHÂN</p><h1>Danh sách thiệp khách mời</h1></div><strong>{invitations.length} thiệp</strong></div>
    {unauthorized ? <section className="adminpanel"><p>Đăng nhập quản trị để xem danh sách khách mời.</p><a className="button" href="/admin">Đến trang đăng nhập</a></section> : <>
      <section className="adminpanel invitation-tools">
        <div><h2>Nhập danh sách</h2><p>Chọn file CSV hoặc Excel .xlsx. Cần cột tên khách. Tên trùng giữ dòng xuất hiện cuối cùng; nhập lại cùng tên sẽ giữ link cũ.</p></div>
        <label>File khách mời<input type="file" accept=".csv,.xlsx" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) upload(file); event.target.value = ""; }} /></label>
        <div className="invitation-add"><input aria-label="Tên khách mới" placeholder="Thêm một khách bằng tên" value={newName} onChange={(event) => setNewName(event.target.value)} /><button disabled={busy || !newName.trim()} onClick={create}>Thêm khách</button></div>
      </section>
      <section className="adminpanel"><div className="toolbar"><h2>Danh sách</h2><input aria-label="Tìm khách" placeholder="Tìm tên, số điện thoại, bên mời…" value={search} onChange={(event) => setSearch(event.target.value)} /><button onClick={exportList} disabled={!invitations.length}>Xuất CSV ↓</button></div>
        <div className="tablewrap"><table><thead><tr><th>Khách mời</th><th>Link thiệp</th><th>Đã xem</th><th>RSVP mới nhất</th><th>Lời chúc / thông tin khách nhập</th><th>Quản lý</th></tr></thead><tbody>
          {filtered.map((item) => { const latest = item.rsvp[0], wish = item.wishes[0], submission = item.submissions[0]; return <tr key={item.id}>
            <td><strong>{item.name}</strong><small>{[item.side, item.event, item.phone].filter(Boolean).join(" · ")}</small><small>{item.invited_count > 0 ? `Mời tối đa ${item.invited_count} người` : "Chưa đặt giới hạn số người"}</small>{item.note && <small>{item.note}</small>}</td>
            <td className="invitation-link"><a href={link(item)} target="_blank" rel="noreferrer">Mở thiệp ↗</a><button onClick={() => navigator.clipboard.writeText(link(item)).then(() => setStatus(`Đã sao chép link của ${item.name}.`)).catch(() => setStatus("Không sao chép được; hãy mở link rồi sao chép từ trình duyệt."))}>Sao chép link</button></td>
            <td>{Number(item.visits) ? <><strong>{item.visits} lượt</strong><small>{item.lastViewed}</small></> : <span className="badge maybe">Chưa xem</span>}</td>
            <td>{latest ? <><span className={`badge ${latest.attending}`}>{latest.attending === "yes" ? "Có dự" : "Không dự"}</span><small>{latest.name} · {latest.count} người · {latest.event || latest.side || ""}</small><small>{latest.created}</small>{latest.message && <p>{latest.message}</p>}</> : <span className="badge maybe">Chưa phản hồi</span>}</td>
            <td>{wish && <p><b>Lời chúc:</b> {wish.wish}<small>{wish.name} · {wish.created}</small></p>}{submission && <p><b>{submission.kind === "order" ? "Đặt hàng" : "Đăng ký"}:</b> {submission.name}<small>{[submission.phone, submission.email].filter(Boolean).join(" · ")}</small>{submission.kind === "order" && <small>{submission.product} · {submission.quantity} × · {Number(submission.total).toLocaleString("vi-VN")} đ</small>}{submission.note && <small>{submission.note}</small>}</p>}{!wish && !submission && <span className="muted">Chưa có</span>}</td>
            <td><button onClick={() => setEdit({ ...item })}>Sửa</button><details><summary>Lịch sử ({item.rsvp.length + item.wishes.length + item.submissions.length})</summary><div className="invitation-history">{item.rsvp.map((r) => <p key={`r${r.id}`}><b>RSVP · {r.created}</b><br />{r.name}: {r.attending === "yes" ? `Có dự (${r.count} người)` : "Không dự"} · {r.event || r.side}<br />{r.message}</p>)}{item.wishes.map((r) => <p key={`w${r.id}`}><b>Lời chúc · {r.created}</b><br />{r.name}: {r.wish}</p>)}{item.submissions.map((r) => <p key={`s${r.id}`}><b>{r.kind === "order" ? "Đặt hàng" : "Đăng ký"} · {r.created}</b><br />{r.name} · {r.phone} · {r.email}<br />{r.kind === "order" && <>{r.product} · {r.quantity} × · {Number(r.total).toLocaleString("vi-VN")} đ<br /></>}{r.note}</p>)}</div></details><button className="danger" onClick={() => remove(item)}>Xóa</button></td>
          </tr>; })}
        </tbody></table></div>{!filtered.length && <p className="empty">Chưa có thiệp phù hợp.</p>}
      </section>
      {edit && <div className="invitation-modal" role="dialog" aria-modal="true" aria-label="Sửa thông tin thiệp"><form onSubmit={(event) => { event.preventDefault(); save(); }}><h2>Sửa thiệp của khách</h2>{([["name", "Tên khách"], ["phone", "Số điện thoại"], ["side", "Bên mời"], ["event", "Sự kiện"], ["invited_count", "Số người được mời (0 = chưa giới hạn)"], ["note", "Ghi chú"]] as const).map(([key, label]) => <label key={key}>{label}<input type={key === "invited_count" ? "number" : "text"} min={key === "invited_count" ? 0 : undefined} max={key === "invited_count" ? 50 : undefined} value={edit[key] ?? ""} onChange={(event) => setEdit({ ...edit, [key]: event.target.value })} required={key === "name"} /></label>)}<div><button type="button" onClick={() => setEdit(null)}>Hủy</button><button className="button" disabled={busy}>Lưu</button></div></form></div>}
    </>}
    <p role="status" className="invitation-status">{status}</p>
  </main>;
}
