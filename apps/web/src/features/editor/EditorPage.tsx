import { AlbumEditor } from "./AlbumEditor";
import { EventFields } from "./EventFields";
import { ImageCropControls } from "./ImageCropControls";
import type { WeddingDocument, EditorState } from "../../lib/types";

import { useEffect, useRef, useState } from "react";
import "./editor.css";
import "./studio.css";
import { Field, Media } from "./fields";
import {
  CatalogPanel,
  MediaPanel,
  StockPanel,
  PresetPanel,
  EffectsPanel,
  BackgroundPanel,
  SettingsPanel,
  StatsPanel,
  WidgetProperties,
  ShareQR,
} from "./studio-panels";
import { WIDGET_CATALOG } from "../../lib/widget-catalog";
const tabs = [
  ["content", "Thông tin chung"],
  ["opening", "Mở thiệp"],
  ["events", "Lịch & sự kiện"],
  ["layers", "Các lớp"],
  ["album", "Ảnh & album"],
  ["forms", "Biểu mẫu"],
  ["gifts", "Nhạc & quà mừng"],
  ["theme", "Màu & trang trí"],
  ["history", "Lịch sử"],
];
const typeLabel = {
  text: "Chữ",
  image: "Ảnh",
  button: "Nút",
  group: "Nhóm",
  calendar: "Lịch",
  countdown: "Đếm ngược",
  rsvp: "Xác nhận",
  wishes: "Lời chúc",
  decoration: "Trang trí",
  shape: "Hình khối",
  album: "Album",
  video: "Video",
  icon: "Biểu tượng",
  social: "Mạng xã hội",
  collapse: "Thu gọn",
  directions: "Chỉ đường",
  map: "Bản đồ",
  call: "Nút gọi",
  chat: "Chat ngay",
  guest: "Tên khách mời",
  registration: "Form đăng ký",
  order: "Form đặt hàng",
  login: "Đăng nhập",
  gift: "Quà mừng",
  timeline: "Lịch trình",
  event: "Sự kiện cưới",
};
const fonts = [
  "Original",
  "Lora",
  "Georgia",
  "Arial",
  "High Spirited",
  "Flavinda",
  "UVN Hoa Tay",
  "WeddingCustom",
];
const clone = (value) => structuredClone(value);
const asUrl = (v) => (v?.startsWith("./") ? "/thiep-01/" + v.slice(2) : v);
export default function Editor() {
  const [doc, setDoc] = useState<WeddingDocument | null>(null),
    [meta, setMeta] = useState<EditorState | null>(null),
    [tab, setTab] = useState("catalog"),
    [selected, setSelected] = useState(null),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [width, setWidth] = useState(600),
    [previewSide, setPreviewSide] = useState("groom"),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [dirty, setDirty] = useState(false),
    [needLogin, setNeedLogin] = useState(false),
    [undo, setUndo] = useState<WeddingDocument[]>([]),
    [redo, setRedo] = useState<WeddingDocument[]>([]);
  const frame = useRef<HTMLIFrameElement | null>(null),
    current = useRef<WeddingDocument | null>(null);
  current.current = doc;
  async function load() {
    setMessage("");
    try {
      const r = await fetch("/api/editor", { cache: "no-store" });
      const d = await r.json();
      if (r.status === 401) {
        setNeedLogin(true);
        return;
      }
      if (!r.ok) throw Error(d.error);
      setMeta(d);
      setDoc(d.document);
      setDirty(false);
      setUndo([]);
      setRedo([]);
      setNeedLogin(false);
    } catch (e) {
      setMessage(e.message || "Không tải được thiệp.");
    }
  }
  useEffect(() => {
    load();
  }, []);
  function change(fn: (document: WeddingDocument) => void) {
    const base = current.current;
    if (!base) return;
    const next = clone(base);
    fn(next);
    current.current = next;
    setUndo((old) => [...old.slice(-39), base]);
    setRedo([]);
    setDoc(next);
    setDirty(true);
    setMessage("");
  }
  function removeNode(id: string) {
    const document = current.current;
    if (!document || !id) return;
    const custom = document.additions.some((node) => node.id === id);
    if (!custom && !meta?.manifest.nodes.some((node) => node.id === id)) return;
    change((draft) => {
      if (custom)
        draft.additions = draft.additions.filter((node) => node.id !== id);
      else {
        draft.nodes[id] ??= { style: {} };
        draft.nodes[id].hidden = true;
      }
    });
    setSelected(null);
    send("select", { id: null });
  }
  function send(type, payload = {}) {
    frame.current?.contentWindow?.postMessage(
      { source: "wedding-editor", type, ...payload },
      location.origin,
    );
  }
  useEffect(() => {
    send("interactive", { value: tab === "preview" });
  }, [tab]);
  useEffect(() => {
    if (!doc) return;
    const timer = setTimeout(
      () => send("render", { document: doc, side: previewSide }),
      180,
    );
    return () => clearTimeout(timer);
  }, [doc, previewSide]);
  useEffect(() => {
    const listener = (e) => {
      if (
        e.origin !== location.origin ||
        e.source !== frame.current?.contentWindow ||
        e.data?.source !== "wedding-preview"
      )
        return;
      const m = e.data;
      if (m.type === "ready") {
        send("render", { document: current.current, side: previewSide });
        send("interactive", { value: tab === "preview" });
      }
      if (m.type === "select") {
        setSelected(m.id);
        setTab("layers");
      }
      if (m.type === "delete") removeNode(m.id);
      if (m.type === "move") {
        change((d) => {
          const added = d.additions.find((n) => n.id === m.id);
          if (added) Object.assign(added.style, { left: m.left, top: m.top });
          else {
            d.nodes[m.id] ??= { style: {} };
            Object.assign(d.nodes[m.id].style, { left: m.left, top: m.top });
          }
        });
        setSelected(m.id);
      }
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [doc, tab, previewSide]);
  useEffect(() => {
    const before = (e) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [dirty]);
  async function login(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "login",
          password: new FormData(e.currentTarget).get("password"),
        }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      await load();
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function persist(action, versionId = undefined) {
    if (busy) return;
    const sent = current.current;
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/editor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          document: sent,
          revision: meta.revision,
          versionId,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setMeta((m) => ({ ...m, ...d }));
      if (action === "restore" || current.current === sent) {
        setDoc(d.document);
        current.current = d.document;
        setDirty(false);
        setUndo([]);
        setRedo([]);
      } else {
        setDirty(true);
        setMessage(
          "Đã lưu nội dung trước đó. Các chỉnh sửa mới hơn vẫn chưa được lưu.",
        );
        return;
      }
      setMessage(
        action === "publish"
          ? "Đã áp dụng lên thiệp khách xem."
          : action === "restore"
            ? "Đã đưa phiên bản cũ vào bản nháp. Bấm Áp dụng để đưa lên thiệp."
            : "Đã lưu bản nháp. Thiệp khách xem chưa thay đổi.",
      );
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function upload(file, onStatus?: (message: string) => void) {
    const status = (text: string) => {
      setMessage(text);
      onStatus?.(text);
    };
    setBusy(true);
    status("Đang tải file gốc " + file.name + "…");
    try {
      const form = new FormData();
      form.append("file", file);
      const r = await fetch("/api/editor/assets", {
        method: "POST",
        body: form,
      });
      const d = await r.json().catch(() => {
        throw Error(
          r.status === 413
            ? "File quá lớn. Vui lòng chọn file nhỏ hơn."
            : "Không tải được file. Vui lòng thử lại.",
        );
      });
      if (!r.ok) throw Error(d.error);
      setMeta((m) => ({ ...m, assets: [d.asset, ...m.assets] }));
      status(
        "Đã tải file gốc, giữ nguyên chất lượng. Lưu bản nháp hoặc áp dụng để giữ thay đổi trên thiệp.",
      );
      return d.asset.url;
    } catch (e) {
      status(
        e.message ||
          "Không xử lý được ảnh. Vui lòng thử ảnh JPG hoặc PNG khác.",
      );
      return null;
    } finally {
      setBusy(false);
    }
  }
  function pick(id) {
    setSelected(id);
    setTab("layers");
    send("select", { id });
  }
  function patch(value) {
    change((d) => {
      const custom = d.additions.find((n) => n.id === selected);
      if (custom) {
        if (value.style) Object.assign(custom.style, value.style);
        else Object.assign(custom, value);
      } else {
        d.nodes[selected] ??= { style: {} };
        if (value.style) Object.assign(d.nodes[selected].style, value.style);
        else Object.assign(d.nodes[selected], value);
      }
    });
  }
  function add(key, extra = {}) {
    const descriptor =
      WIDGET_CATALOG.find((x) => x.id === key) ||
      WIDGET_CATALOG.find((x) => x.type === key);
    if (!descriptor) return;
    const type = descriptor.type,
      id = "custom_" + crypto.randomUUID(),
      props = clone(descriptor.props);
    if (props.date && descriptor.type !== "event")
      props.date = current.current.settings.date;
    const generic = [
      "text",
      "button",
      "shape",
      "image",
      "icon",
      "guest",
      "call",
      "gift",
    ].includes(type);
    const height = type === "image" ? 300 : generic ? 90 : 230;
    const iframeDoc = frame.current?.contentDocument;
    const canvas = iframeDoc?.querySelector(".miu-canvas");
    const scale = canvas ? canvas.getBoundingClientRect().width / 575 : 1;
    const top = Math.max(
      150,
      Math.round(((iframeDoc?.documentElement.scrollTop || 0) + 120) / scale),
    );
    const item = {
      id,
      type,
      text: descriptor.text,
      props,
      style: {
        left: "40px",
        top: top + "px",
        width: "450px",
        height: height + "px",
        fontSize: "26px",
        color: "#4e6437",
        zIndex: "20",
        ...(type === "shape"
          ? { backgroundColor: "#e1e7d8", borderRadius: "16px" }
          : {}),
        ...descriptor.style,
      },
      ...(type === "image"
        ? { src: "/thiep-01/1793892037600-HIU_7932.webp" }
        : {}),
      ...(type === "button" ? { href: "" } : {}),
      ...extra,
    };
    change((d) => {
      d.additions.push(item);
      d.theme.canvasHeight = Math.max(
        d.theme.canvasHeight,
        top + parseFloat(item.style.height) + 80,
      );
    });
    pick(id);
    setTimeout(() => send("select", { id }), 280);
  }

  if (needLogin)
    return (
      <main className="ed-login">
        <a href="/admin">← Quản trị</a>
        <p className="ed-kicker">THIỆP 01 / TRÌNH CHỈNH SỬA</p>
        <h1>
          Thiệp của hai bạn,
          <br />
          theo cách hai bạn muốn.
        </h1>
        <form onSubmit={login}>
          <label htmlFor="editor-password">Mật khẩu quản trị</label>
          <input
            id="editor-password"
            type="password"
            name="password"
            required
            autoComplete="current-password"
            aria-label="Mật khẩu"
          />
          <button disabled={busy} className="ed-primary">
            Đăng nhập để chỉnh sửa
          </button>
        </form>
        <p role="status">{message}</p>
      </main>
    );
  if (!doc || !meta)
    return (
      <main className="ed-loading">
        <h1>Đang mở thiệp…</h1>
        <p role="status">{message}</p>
        <button onClick={load}>Thử tải lại</button>
      </main>
    );
  const nodes = [
    ...meta.manifest.nodes,
    ...doc.additions.map((n, i) => ({
      ...n,
      label: n.text || "Ảnh bổ sung",
      index: 1000 + i,
    })),
  ];
  const node = nodes.find((n) => n.id === selected),
    override = doc.nodes[selected] || {},
    value = !node
      ? null
      : node?.id?.startsWith("custom_")
        ? node
        : {
            ...node,
            ...override,
            style: { ...node?.style, ...override.style },
          };
  const assets = [
    ...meta.assets,
    ...meta.manifest.nodes
      .filter((n) => n.type === "image" && n.src)
      .map((n) => ({
        id: n.id,
        filename: n.src.split("/").pop(),
        original_name: n.src.split("/").pop(),
        bytes: 0,
        url: asUrl(n.src),
        mime: "image/original",
      })),
  ];
  const mediaProps = { upload, assets };
  const setSetting = (k, v) =>
    change((d) => {
      d.settings[k] = v;
      if (["date", "venue", "address"].includes(k)) d.events.groom[k] = v;
    });
  const setEvent = (side, k, v) =>
    change((d) => {
      d.events[side][k] = v;
      if (side === "groom" && ["date", "venue", "address"].includes(k))
        d.settings[k] = v;
    });
  return (
    <main className="builder">
      <header className="ed-top">
        <a className="ed-logo" href="/admin">
          ✳{" "}
          <span>
            Ngày chung đôi<small>THIỆP 01 / STUDIO</small>
          </span>
        </a>
        <div className="ed-top-status">
          <span className={dirty ? "ed-dot dirty" : "ed-dot"} />
          {dirty ? "Có thay đổi chưa lưu" : "Bản nháp đã sẵn sàng"}
        </div>
        <div className="ed-top-actions">
          <button
            disabled={!undo.length || busy}
            title="Hoàn tác"
            onClick={() => {
              setRedo((r) => [...r, doc]);
              setDoc(undo.at(-1));
              setUndo((u) => u.slice(0, -1));
              setDirty(true);
            }}
          >
            ↶
          </button>
          <button
            disabled={!redo.length || busy}
            title="Làm lại"
            onClick={() => {
              setUndo((u) => [...u, doc]);
              setDoc(redo.at(-1));
              setRedo((r) => r.slice(0, -1));
              setDirty(true);
            }}
          >
            ↷
          </button>
          <a href="/" target="_blank" rel="noreferrer">
            Xem thiệp ↗
          </a>
          <button disabled={busy} onClick={() => persist("save")}>
            Lưu bản nháp
          </button>
          <button
            disabled={busy}
            className="ed-primary"
            onClick={() => persist("publish")}
          >
            {busy ? "Đang xử lý…" : "Áp dụng lên thiệp"}
          </button>
        </div>
      </header>
      <div className="ed-notice" role="status">
        {message ||
          "Bấm vào một thành phần trên thiệp để chỉnh sửa. Kéo thành phần để đổi vị trí. Bản nháp chỉ mình bạn xem được."}
      </div>
      <div className="ed-workspace">
        <nav className="studio-rail" aria-label="Công cụ chỉnh thiệp">
          {[
            ["catalog", "▦", "Thành phần"],
            ["stock", "▧", "Stock"],
            ["preset", "♧", "Preset"],
            ["background", "□", "Nền"],
            ["effects", "✧", "Hiệu ứng"],
            ["media", "▣", "Media"],
            ["preview", "↓", "Preview"],
            ["stats", "▥", "Thống kê"],
            ["settings", "⚙", "Cài đặt"],
          ].map(([id, icon, label]) => (
            <button
              aria-label={label}
              key={id}
              className={
                tab === id ||
                (id === "settings" &&
                  [
                    "content",
                    "events",
                    "forms",
                    "gifts",
                    "theme",
                    "history",
                    "album",
                  ].includes(tab)) ||
                (id === "catalog" && tab === "layers")
                  ? "active"
                  : ""
              }
              onClick={() => setTab(id)}
            >
              <span>{icon}</span>
              {label}
            </button>
          ))}
          <button className="studio-help" onClick={() => setTab("help")}>
            <span>ⓘ</span>Hỗ trợ
          </button>
        </nav>
        <aside className="ed-sidebar">
          {![
            "catalog",
            "stock",
            "preset",
            "background",
            "effects",
            "media",
            "preview",
            "stats",
            "settings",
            "help",
          ].includes(tab) && (
            <div className="ed-tabgrid">
              {tabs.map(([id, name]) => (
                <button
                  key={id}
                  className={tab === id ? "active" : ""}
                  onClick={() => setTab(id)}
                >
                  {name}
                </button>
              ))}
            </div>
          )}
          <div className="ed-controls">
            {tab === "help" && (
              <>
                <h2>Hướng dẫn chỉnh thiệp</h2>
                <ol className="studio-help-list">
                  <li>
                    Thêm khối từ Thành phần hoặc chọn khối đang có trên thiệp.
                  </li>
                  <li>
                    Kéo để đổi vị trí; sửa chữ, ảnh, kích thước và cấu hình ở
                    cột Thuộc tính.
                  </li>
                  <li>
                    Tải nhiều ảnh/video trong Media. File đang dùng hoặc có
                    trong lịch sử được bảo vệ khi dọn file.
                  </li>
                  <li>
                    Lưu bản nháp để tiếp tục chỉnh sau. Áp dụng lên thiệp khi
                    muốn khách thấy thay đổi.
                  </li>
                  <li>
                    Vào Cài đặt để đổi slug, tên khách và tải QR chia sẻ. Link
                    local chỉ mở trên máy hiện tại.
                  </li>
                  <li>
                    Thống kê hiển thị lượt xem, RSVP và các đăng ký/yêu cầu đặt
                    hàng thực tế.
                  </li>
                </ol>
                <a className="studio-dashboard-link" href="/admin">
                  Mở trang quản trị ↗
                </a>
              </>
            )}
            {tab === "catalog" && (
              <CatalogPanel add={add} layers={() => setTab("layers")} />
            )}
            {tab === "stock" && <StockPanel add={add} change={change} />}
            {tab === "media" && (
              <MediaPanel
                doc={doc}
                meta={meta}
                setMeta={setMeta}
                upload={upload}
                add={add}
                message={setMessage}
              />
            )}
            {tab === "preset" && (
              <PresetPanel doc={doc} change={change} message={setMessage} />
            )}
            {tab === "effects" && (
              <EffectsPanel doc={doc} change={change} go={setTab} />
            )}
            {tab === "background" && (
              <BackgroundPanel
                doc={doc}
                change={change}
                mediaProps={mediaProps}
              />
            )}
            {tab === "settings" && (
              <SettingsPanel doc={doc} change={change} go={setTab} />
            )}
            {tab === "stats" && <StatsPanel message={setMessage} />}
            {tab === "preview" && (
              <>
                <h2>Xem trước</h2>
                <p className="ed-help">
                  Bạn có thể thử các nút, album, video và nội dung thu gọn trong
                  khung. Biểu mẫu không gửi dữ liệu trong chế độ nháp.
                </p>
                <div className="studio-row">
                  <button onClick={() => setWidth(390)}>Xem điện thoại</button>
                  <button onClick={() => setWidth(600)}>Xem máy tính</button>
                  <button onClick={() => send("opening")}>
                    Thử mở phong bì
                  </button>
                </div>
                <a
                  className="studio-dashboard-link"
                  href="/admin/preview"
                  target="_blank"
                  rel="noreferrer"
                >
                  Mở bản nháp đã lưu ở tab riêng ↗
                </a>
                <ShareQR doc={doc} />
              </>
            )}
            {tab === "content" && (
              <>
                <p className="ed-kicker">CÂU CHUYỆN CỦA HAI BẠN</p>
                <h2>Thông tin chung</h2>
                {[
                  ["groom", "Tên chú rể"],
                  ["bride", "Tên cô dâu"],
                  ["story", "Lời giới thiệu"],
                ].map(([key, label]) => (
                  <Field
                    key={key}
                    label={label}
                    value={doc.settings[key]}
                    multiline={key === "story"}
                    onChange={(v) => setSetting(key, v)}
                  />
                ))}
                <Media
                  label="Ảnh giới thiệu chú rể"
                  value={doc.settings.photo}
                  onChange={(v) => setSetting("photo", v)}
                  {...mediaProps}
                />
                <h3>Hai gia đình</h3>
                {[
                  ["element_text_rudjs5mvvr6", "Bố chú rể"],
                  ["element_text_pbbrmyuvvr6", "Mẹ chú rể"],
                  ["element_text_372cz3lvvr6", "Bố cô dâu"],
                  ["element_text_yhbrz9wvvr6", "Mẹ cô dâu"],
                ].map(([id, label]) => (
                  <Field
                    key={id}
                    label={label}
                    value={
                      doc.nodes[id]?.text ??
                      meta.manifest.nodes.find((n) => n.id === id)?.text ??
                      ""
                    }
                    onChange={(v) =>
                      change((d) => {
                        d.nodes[id] ??= { style: {} };
                        d.nodes[id].text = v;
                      })
                    }
                  />
                ))}
                <p className="ed-help">
                  Tên bố mẹ, vai vế và các câu chữ khác: chọn ngay trên thiệp
                  hoặc trong mục Thành phần.
                </p>
                <button onClick={() => setTab("layers")}>
                  Sửa từng câu chữ →
                </button>
              </>
            )}
            {tab === "opening" && (
              <>
                <h2>Màn mở thiệp</h2>
                <label className="ed-check">
                  <input
                    type="checkbox"
                    checked={doc.opening.enabled}
                    onChange={(e) =>
                      change((d) => {
                        d.opening.enabled = e.target.checked;
                      })
                    }
                  />
                  Bật màn mở thiệp
                </label>
                {[
                  ["title", "Lời mời trên phong bì"],
                  ["invite", "Tên người nhận / lời xưng hô"],
                  ["button", "Chữ nút mở thiệp"],
                ].map(([k, l]) => (
                  <Field
                    key={k}
                    label={l}
                    value={doc.opening[k]}
                    onChange={(v) =>
                      change((d) => {
                        d.opening[k] = v;
                        if (k === "invite") d.site.guestName = v;
                      })
                    }
                  />
                ))}
                <Field
                  type="color"
                  label="Màu nền màn mở"
                  value={doc.opening.background}
                  onChange={(v) =>
                    change((d) => {
                      d.opening.background = v;
                    })
                  }
                />
                <button onClick={() => send("opening")}>
                  Xem màn mở thiệp
                </button>
                {[
                  ["envelope", "Ảnh phong bì"],
                  ["seal", "Ảnh con dấu"],
                  ["flowerLeft", "Hoa bên trái"],
                  ["flowerRight", "Hoa bên phải"],
                  ["chain", "Dây trang trí"],
                  ["buttonImage", "Ảnh nút mở"],
                ].map(([k, l]) => (
                  <Media
                    key={k}
                    label={l}
                    value={doc.opening.images[k]}
                    onChange={(v) =>
                      change((d) => {
                        d.opening.images[k] = v;
                      })
                    }
                    {...mediaProps}
                  />
                ))}
              </>
            )}
            {tab === "events" && (
              <>
                <h2>Các sự kiện cưới</h2>
                {doc.additions
                  .filter((n) => n.type === "event")
                  .map((n) => (
                    <section className="ed-card" key={n.id}>
                      <h3>{n.text}</h3>
                      <EventFields
                        value={n.props || {}}
                        onChange={(key, v) =>
                          change((d) => {
                            const event = d.additions.find(
                              (a) => a.id === n.id,
                            );
                            event.props = { ...event.props, [key]: v };
                          })
                        }
                      />
                    </section>
                  ))}
                {["groom", "bride"].map((side) => (
                  <section className="ed-card" key={side}>
                    <h3>{side === "groom" ? "Nhà trai" : "Nhà gái"}</h3>
                    {[
                      ["date", "Ngày giờ (Việt Nam)"],
                      ["venue", "Địa điểm"],
                      ["address", "Địa chỉ"],
                      ["mapUrl", "Đường dẫn bản đồ (để trống để tự tạo)"],
                      ["lunar", "Ngày âm lịch / ghi chú"],
                    ].map(([key, label]) => (
                      <Field
                        key={key}
                        label={label}
                        type={key === "date" ? "datetime-local" : "text"}
                        value={doc.events[side][key]}
                        onChange={(v) => setEvent(side, key, v)}
                        multiline={key === "address"}
                      />
                    ))}
                  </section>
                ))}
              </>
            )}
            {tab === "layers" && (
              <>
                <div className="ed-heading">
                  <h2>
                    Thành phần <small>{nodes.length}</small>
                  </h2>
                </div>
                <div className="ed-add">
                  {[
                    ["text", "+ Chữ"],
                    ["image", "+ Ảnh"],
                    ["button", "+ Nút"],
                    ["shape", "+ Hình"],
                  ].map(([t, l]) => (
                    <button key={t} onClick={() => add(t)}>
                      {l}
                    </button>
                  ))}
                </div>
                <input
                  aria-label="Tìm thành phần"
                  placeholder="Tìm chữ, ảnh, tên bố mẹ…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <select
                  aria-label="Lọc thành phần"
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="all">Tất cả thành phần</option>
                  {Object.entries(typeLabel).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
                <div className="ed-layers">
                  {nodes
                    .filter(
                      (n) =>
                        (filter === "all" || n.type === filter) &&
                        (n.label + " " + n.id)
                          .toLowerCase()
                          .includes(search.toLowerCase()),
                    )
                    .map((n) => (
                      <button
                        key={n.id}
                        className={selected === n.id ? "selected" : ""}
                        onClick={() => pick(n.id)}
                      >
                        <span className="ed-type">
                          {typeLabel[n.type] || n.type}
                        </span>
                        <span>
                          {doc.nodes[n.id]?.text ?? n.label ?? n.text ?? n.id}
                        </span>
                        {doc.nodes[n.id]?.hidden && <small>Ẩn</small>}
                      </button>
                    ))}
                </div>
              </>
            )}
            {tab === "album" && (
              <>
                <h2>Album ảnh</h2>
                <p className="ed-help">
                  Đổi ảnh, chú thích, thứ tự hoặc thêm ảnh. Ảnh lớn sẽ mở trong
                  album của khách.
                </p>
                <AlbumEditor
                  photos={doc.album}
                  change={change}
                  busy={busy}
                  {...mediaProps}
                />
              </>
            )}
            {tab === "forms" && (
              <>
                <h2>Lời chúc & RSVP</h2>
                {["rsvp", "wishes"].map((key) => (
                  <section className="ed-card" key={key}>
                    <h3>
                      {key === "rsvp" ? "Xác nhận tham dự" : "Sổ lưu bút"}
                    </h3>
                    {[
                      ["title", "Tiêu đề"],
                      ["subtitle", "Lời hướng dẫn"],
                      ["button", "Chữ trên nút"],
                      ["namePlaceholder", "Gợi ý ô họ tên"],
                      ["messagePlaceholder", "Gợi ý ô lời nhắn"],
                    ].map(([k, l]) => (
                      <Field
                        key={k}
                        label={l}
                        value={doc.forms[key][k]}
                        onChange={(v) =>
                          change((d) => {
                            d.forms[key][k] = v;
                          })
                        }
                        multiline={k === "subtitle"}
                      />
                    ))}
                    {key === "rsvp" && (
                      <Field
                        label="Danh sách sự kiện (mỗi dòng một sự kiện)"
                        multiline
                        value={doc.forms.rsvp.events.join("\n")}
                        onChange={(v) =>
                          change((d) => {
                            d.forms.rsvp.events = v.split("\n");
                          })
                        }
                      />
                    )}
                  </section>
                ))}
              </>
            )}
            {tab === "gifts" && (
              <>
                <h2>Nhạc & quà mừng</h2>
                <section className="ed-card">
                  <h3>Nhạc nền</h3>
                  <label className="ed-check">
                    <input
                      type="checkbox"
                      checked={doc.music.enabled}
                      onChange={(e) =>
                        change((d) => {
                          d.music.enabled = e.target.checked;
                        })
                      }
                    />
                    Bật nhạc nền
                  </label>
                  <Media
                    label="File nhạc"
                    kind="audio"
                    value={doc.music.src}
                    onChange={(v) =>
                      change((d) => {
                        d.music.src = v;
                      })
                    }
                    {...mediaProps}
                  />
                </section>
                {["groom", "bride"].map((side) => (
                  <section key={side} className="ed-card">
                    <h3>Quà mừng {side === "groom" ? "chú rể" : "cô dâu"}</h3>
                    <label className="ed-check">
                      <input
                        type="checkbox"
                        checked={doc.gifts[side].enabled}
                        onChange={(e) =>
                          change((d) => {
                            d.gifts[side].enabled = e.target.checked;
                          })
                        }
                      />
                      Hiển thị nút quà mừng
                    </label>
                    <Media
                      label={"QR " + (side === "groom" ? "chú rể" : "cô dâu")}
                      value={doc.gifts[side].qr}
                      onChange={(v) =>
                        change((d) => {
                          d.gifts[side].qr = v;
                        })
                      }
                      {...mediaProps}
                    />
                    {[
                      ["bank", "Ngân hàng"],
                      ["account", "Số tài khoản"],
                      ["holder", "Chủ tài khoản"],
                    ].map(([k, l]) => (
                      <Field
                        key={k}
                        label={l}
                        value={doc.gifts[side][k]}
                        onChange={(v) =>
                          change((d) => {
                            d.gifts[side][k] = v;
                          })
                        }
                      />
                    ))}
                  </section>
                ))}
              </>
            )}
            {tab === "theme" && (
              <>
                <h2>Màu & trang trí</h2>
                <Field
                  label="Màu chủ đạo"
                  type="color"
                  value={doc.theme.primary}
                  onChange={(v) =>
                    change((d) => {
                      d.theme.primary = v;
                    })
                  }
                />
                <Field
                  label="Màu nền thiệp"
                  type="color"
                  value={doc.theme.background}
                  onChange={(v) =>
                    change((d) => {
                      d.theme.background = v;
                    })
                  }
                />
                <label className="ed-field">
                  <span>Font chung</span>
                  <select
                    value={doc.theme.fontFamily}
                    onChange={(e) =>
                      change((d) => {
                        d.theme.fontFamily = e.target.value;
                      })
                    }
                  >
                    {fonts.map((f) => (
                      <option key={f} value={f}>
                        {f === "Original"
                          ? "Giữ các font gốc"
                          : f === "WeddingCustom"
                            ? "Font tải lên"
                            : f}
                      </option>
                    ))}
                  </select>
                </label>
                <Media
                  label="File font riêng"
                  kind="font"
                  value={doc.theme.fontUrl}
                  onChange={(v) =>
                    change((d) => {
                      d.theme.fontUrl = v;
                      d.theme.fontFamily = "WeddingCustom";
                    })
                  }
                  {...mediaProps}
                />
                <Field
                  label="Chiều cao thiệp (px)"
                  type="number"
                  min="1000"
                  max="40000"
                  value={doc.theme.canvasHeight}
                  onChange={(v) =>
                    change((d) => {
                      d.theme.canvasHeight = Number(v);
                    })
                  }
                />
                <p className="ed-help">
                  Chọn từng thành phần để đổi nền, viền, góc xoay, màu chữ và vị
                  trí. Tăng chiều cao khi thêm nội dung ở cuối thiệp.
                </p>
              </>
            )}
            {tab === "history" && (
              <>
                <h2>Lịch sử áp dụng</h2>
                <p className="ed-help">
                  Khôi phục sẽ đưa nội dung cũ vào bản nháp để bạn xem trước.
                </p>
                {meta.versions.length ? (
                  meta.versions.map((v) => (
                    <section key={v.id} className="ed-card">
                      <strong>Phiên bản #{v.id}</strong>
                      <p>{v.created} UTC</p>
                      <button
                        disabled={busy}
                        onClick={() => {
                          if (
                            !dirty ||
                            confirm(
                              "Bỏ thay đổi chưa lưu và lấy lại phiên bản này?",
                            )
                          )
                            persist("restore", v.id);
                        }}
                      >
                        Khôi phục vào nháp
                      </button>
                    </section>
                  ))
                ) : (
                  <p>Chưa có phiên bản được áp dụng.</p>
                )}
              </>
            )}
          </div>
        </aside>
        <section className="ed-preview">
          <div className="ed-preview-toolbar">
            <span>XEM TRƯỚC BẢN NHÁP</span>
            <div>
              <button
                className={width === 390 ? "active" : ""}
                onClick={() => setWidth(390)}
              >
                Điện thoại
              </button>
              <button
                className={width === 600 ? "active" : ""}
                onClick={() => setWidth(600)}
              >
                Máy tính
              </button>
            </div>
            <small>{width}px</small>
            <select
              aria-label="Xem trước bên mời"
              value={previewSide}
              onChange={(e) => setPreviewSide(e.target.value)}
            >
              <option value="groom">Thiệp nhà trai</option>
              <option value="bride">Thiệp nhà gái</option>
            </select>
          </div>
          <div className="ed-frame-area">
            <iframe
              ref={frame}
              title="Xem trước thiệp đang chỉnh"
              src="/thiep-01/index.html?editorPreview=1"
              style={{ width }}
            />
          </div>
        </section>
        <aside className="ed-inspector">
          <p className="ed-kicker">THUỘC TÍNH</p>
          {value ? (
            <>
              <h2>{typeLabel[value.type] || "Thành phần"}</h2>
              <p className="ed-node-id">{selected}</p>
              {(["text", "button"].includes(value.type) ||
                (selected.startsWith("custom_") &&
                  !["image", "video", "shape", "icon"].includes(
                    value.type,
                  ))) && (
                <Field
                  label="Nội dung thành phần"
                  multiline
                  value={value.text}
                  onChange={(v) => patch({ text: v })}
                />
              )}{" "}
              {value.type === "image" && (
                <Media
                  label="Ảnh thành phần"
                  value={value.src}
                  onChange={(v) => patch({ src: v })}
                  {...mediaProps}
                />
              )}{" "}
              {value.type === "button" && (
                <Field
                  label="Đường dẫn khi bấm"
                  value={value.href}
                  onChange={(v) => patch({ href: v })}
                />
              )}
              {value.type === "album" && !selected.startsWith("custom_") && (
                <>
                  <p className="ed-help">
                    Tải ảnh thay thế hoặc chọn từ thư viện cho từng ảnh bên
                    dưới. Bấm Lưu bản nháp hoặc Áp dụng lên thiệp để lưu thay
                    đổi.
                  </p>
                  <AlbumEditor
                    photos={doc.album}
                    change={change}
                    busy={busy}
                    {...mediaProps}
                  />
                </>
              )}
              {selected.startsWith("custom_") && (
                <WidgetProperties
                  value={value}
                  patch={patch}
                  mediaProps={mediaProps}
                />
              )}
              <div className="ed-grid2">
                {[
                  ["left", "Trái (px)"],
                  ["top", "Trên (px)"],
                  ["width", "Rộng (px)"],
                  ["height", "Cao (px)"],
                  ["fontSize", "Cỡ chữ (px)"],
                  ["borderRadius", "Bo góc (px)"],
                ].map(([k, l]) => (
                  <Field
                    key={k}
                    label={l}
                    type="number"
                    value={parseFloat(value.style?.[k]) || 0}
                    onChange={(v) => patch({ style: { [k]: v + "px" } })}
                  />
                ))}
              </div>
              <Field
                label="Màu chữ"
                value={value.style?.color || ""}
                onChange={(v) => patch({ style: { color: v } })}
              />
              <Field
                label="Màu nền"
                value={value.style?.backgroundColor || ""}
                onChange={(v) => patch({ style: { backgroundColor: v } })}
              />
              <Field
                label="Font thành phần"
                value={value.style?.fontFamily || ""}
                onChange={(v) => patch({ style: { fontFamily: v } })}
              />
              <div className="ed-grid2">
                <Field
                  label="Độ đậm"
                  value={value.style?.fontWeight || "400"}
                  onChange={(v) => patch({ style: { fontWeight: v } })}
                />
                <Field
                  label="Lớp trước/sau"
                  type="number"
                  value={value.style?.zIndex || "0"}
                  onChange={(v) => patch({ style: { zIndex: v } })}
                />
              </div>
              <label className="ed-field">
                <span>Căn chữ</span>
                <select
                  value={value.style?.textAlign || "left"}
                  onChange={(e) =>
                    patch({ style: { textAlign: e.target.value } })
                  }
                >
                  {["left", "center", "right", "justify"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label className="ed-field">
                <span>Kiểu chữ</span>
                <select
                  value={value.style?.fontStyle || "normal"}
                  onChange={(e) =>
                    patch({ style: { fontStyle: e.target.value } })
                  }
                >
                  <option value="normal">Thường</option>
                  <option value="italic">Nghiêng</option>
                </select>
              </label>
              <Field
                label="Giãn dòng"
                value={value.style?.lineHeight || ""}
                onChange={(v) => patch({ style: { lineHeight: v } })}
              />
              <Field
                label="Giãn chữ"
                value={value.style?.letterSpacing || ""}
                onChange={(v) => patch({ style: { letterSpacing: v } })}
              />
              <Field
                label="Khoảng đệm (padding)"
                value={value.style?.padding || ""}
                onChange={(v) => patch({ style: { padding: v } })}
              />
              <label className="ed-field">
                <span>Hiệu ứng</span>
                <select
                  value={value.style?.animationName || ""}
                  onChange={(e) =>
                    patch({ style: { animationName: e.target.value } })
                  }
                >
                  {[
                    ["", "Giữ hiệu ứng gốc"],
                    ["none", "Không hiệu ứng"],
                    ["miu-fadeIn", "Hiện dần"],
                    ["miu-fadeInDown", "Trượt từ trên"],
                    ["miu-fadeInLeft", "Trượt từ trái"],
                    ["miu-pop", "Phóng nhẹ"],
                  ].map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </label>
              <Field
                label="Thời gian hiệu ứng (vd: 1600ms)"
                value={value.style?.animationDuration || ""}
                onChange={(v) => patch({ style: { animationDuration: v } })}
              />
              <Field
                label="Độ trễ hiệu ứng (vd: 300ms)"
                value={value.style?.animationDelay || ""}
                onChange={(v) => patch({ style: { animationDelay: v } })}
              />
              <Field
                label="Góc xoay / transform"
                value={value.style?.transform || ""}
                onChange={(v) => patch({ style: { transform: v } })}
              />
              <Field
                label="Viền (vd: 1px solid #4e6437)"
                value={value.style?.border || ""}
                onChange={(v) => patch({ style: { border: v } })}
              />
              <Field
                label="Bóng đổ"
                value={value.style?.boxShadow || ""}
                onChange={(v) => patch({ style: { boxShadow: v } })}
              />
              <Field
                label="Độ mờ (0–1)"
                type="number"
                step="0.05"
                min="0"
                max="1"
                value={value.style?.opacity || "1"}
                onChange={(v) => patch({ style: { opacity: v } })}
              />
              <label className="ed-check">
                <input
                  type="checkbox"
                  checked={!!value.hidden}
                  onChange={(e) => patch({ hidden: e.target.checked })}
                />
                Ẩn thành phần
              </label>
              {value.type === "image" && (
                <>
                  <ImageCropControls
                    label="Canh ảnh"
                    value={value.crop}
                    onChange={(crop) => patch({ crop })}
                  />
                  {selected === "element_image_sl7w5g2lfcf" &&
                    ["Khung trái", "Khung giữa", "Khung phải"].map(
                      (label, i) => (
                        <ImageCropControls
                          key={label}
                          label={label}
                          value={value.panelCrops?.[i]}
                          onChange={(crop) => {
                            const panelCrops = [0, 1, 2].map(
                              (index) =>
                                value.panelCrops?.[index] || {
                                  zoom: 100,
                                  x: 0,
                                  y: 0,
                                },
                            );
                            panelCrops[i] = crop;
                            patch({ panelCrops });
                          }}
                        />
                      ),
                    )}
                  <label className="ed-field">
                    <span>Cách hiển thị ảnh</span>
                    <select
                      value={value.style?.objectFit || "cover"}
                      onChange={(e) =>
                        patch({ style: { objectFit: e.target.value } })
                      }
                    >
                      {["cover", "contain", "fill"].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                  <Field
                    label="Điểm canh ảnh (vd: 50% 50%)"
                    value={value.style?.objectPosition || "50% 50%"}
                    onChange={(v) => patch({ style: { objectPosition: v } })}
                  />
                </>
              )}
              <div className="ed-inspector-actions">
                <button
                  onClick={() =>
                    change((d) => {
                      if (selected.startsWith("custom_"))
                        d.additions = d.additions.filter(
                          (n) => n.id !== selected,
                        );
                      else delete d.nodes[selected];
                    })
                  }
                >
                  Khôi phục / bỏ chỉnh sửa
                </button>
                <button
                  className="ed-danger"
                  onClick={() => removeNode(selected)}
                >
                  Xóa thành phần
                </button>
              </div>
            </>
          ) : (
            <div className="ed-empty">
              <span>↖</span>
              <h3>Chọn một thành phần</h3>
              <p>Bấm vào chữ, ảnh hoặc nút trên thiệp để chỉnh sửa chi tiết.</p>
              <button onClick={() => setTab("layers")}>
                Xem danh sách thành phần
              </button>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
