import { useEffect, useRef, useState } from "react";
import { Field, Media } from "./fields";
import { WIDGET_CATALOG, PALETTES, STOCK } from "../../lib/widget-catalog";
export function CatalogPanel({ add, layers }: any) {
  const [search, setSearch] = useState("");
  return (
    <>
      <h2>Thành phần</h2>
      <input
        aria-label="Tìm trong thư viện thành phần"
        placeholder="Tìm thành phần…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <button className="studio-layer-link" onClick={layers}>
        ☷ Các lớp trên thiệp
      </button>
      {["Cơ bản", "Tương tác", "Nâng cao"].map((group) => (
        <section className="studio-catalog-section" key={group}>
          <h3>{group}</h3>
          <div className="studio-catalog-grid">
            {WIDGET_CATALOG.filter(
              (x) =>
                x.group === group &&
                x.label.toLowerCase().includes(search.toLowerCase()),
            ).map((x) => (
              <button aria-label={x.label} key={x.id} onClick={() => add(x.id)}>
                <span>{x.icon}</span>
                <b>{x.label}</b>
              </button>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
export function StockPanel({ add, change }: any) {
  return (
    <>
      <h2>Ảnh có sẵn</h2>
      <p className="ed-help">Trang trí và nền có sẵn trong dự án.</p>
      <div className="studio-media-grid">
        {STOCK.map((s) => (
          <article key={s.src}>
            <img src={s.src} alt={s.name} />
            <b>{s.name}</b>
            <div>
              <button onClick={() => add("image", { src: s.src })}>
                Thêm ảnh
              </button>
              <button
                onClick={() =>
                  change((d) => {
                    d.theme.backgroundImage = s.src;
                  })
                }
              >
                Làm nền
              </button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
export function MediaPanel({ doc, meta, setMeta, upload, add, message }: any) {
  const input = useRef(null),
    [filter, setFilter] = useState("all");
  const serialized = JSON.stringify(doc);
  const bundled = [
    ...new Map(
      meta.manifest.nodes
        .filter((n) => n.type === "image" && n.src)
        .map((n) => {
          const url = n.src.startsWith("./")
            ? "/thiep-01/" + n.src.slice(2)
            : n.src;
          return [
            url,
            {
              id: "original_" + n.id,
              filename: n.src.split("/").pop(),
              original_name: n.src.split("/").pop(),
              url,
              mime: "image/original",
              bytes: 0,
              original: true,
            },
          ];
        }),
    ).values(),
  ];
  const filtered = [...meta.assets, ...bundled].filter(
    (a) => filter === "all" || a.mime.startsWith(filter + "/"),
  );
  async function cleanup(id = undefined) {
    const protectedUrls = [
      ...serialized.matchAll(/\/media\/[a-f0-9-]{36}\.[a-z0-9]+/g),
    ].map((x) => x[0]);
    try {
      const r = await fetch("/api/editor/assets", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: id ? "single" : "unused",
          id,
          protectedUrls,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setMeta((m) => ({
        ...m,
        assets: m.assets.filter((a) => !d.deleted.includes(a.id)),
      }));
      message(
        "Đã xóa " +
          d.deleted.length +
          " file chưa dùng" +
          (d.skipped.length
            ? "; giữ lại " +
              d.skipped.length +
              " file đang dùng trong thiệp hoặc lịch sử."
            : "."),
      );
    } catch (e) {
      message(e.message);
    }
  }
  return (
    <>
      <h2>Media</h2>
      <button className="studio-drop" onClick={() => input.current.click()}>
        <span>＋</span>Nhấn để chọn nhiều ảnh, video hoặc nhạc
      </button>
      <input
        ref={input}
        type="file"
        multiple
        hidden
        accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,audio/*,.ttf,.otf,.woff2"
        onChange={async (e) => {
          for (const f of [...e.target.files]) await upload(f);
          e.target.value = "";
        }}
      />
      <div className="studio-media-heading">
        <span>File đã tải ({meta.assets.length})</span>
        <button
          onClick={() => {
            if (
              confirm(
                "Xóa file chưa được sử dụng? File trong bản nháp, bản đang áp dụng hoặc lịch sử sẽ được giữ lại.",
              )
            )
              cleanup();
          }}
        >
          Xóa file chưa dùng
        </button>
      </div>
      <select
        aria-label="Lọc media"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      >
        <option value="all">Tất cả</option>
        <option value="image">Ảnh</option>
        <option value="video">Video</option>
        <option value="audio">Nhạc</option>
        <option value="font">Font</option>
      </select>
      {!filtered.length ? (
        <p className="ed-help">
          Chưa có file ở mục này. Bạn có thể chọn ảnh có sẵn trong Stock.
        </p>
      ) : (
        <div className="studio-media-grid">
          {filtered.map((a) => {
            const url = a.url || "/media/" + a.filename,
              used = a.original || serialized.includes(url);
            return (
              <article key={a.id}>
                {a.mime.startsWith("image/") ? (
                  <img src={url} alt={a.original_name} />
                ) : (
                  <div className="studio-media-type">
                    {a.mime.startsWith("video/")
                      ? "▷"
                      : a.mime.startsWith("audio/")
                        ? "♫"
                        : "Aa"}
                  </div>
                )}
                {used && <small className="studio-used">Đã dùng</small>}
                <b title={a.original_name}>{a.original_name}</b>
                <small>
                  {a.original
                    ? "Ảnh trong mẫu"
                    : Math.round(a.bytes / 1024) + " KB"}
                </small>
                <div>
                  {["image", "video"].some((t) =>
                    a.mime.startsWith(t + "/"),
                  ) && (
                    <button
                      onClick={() =>
                        add(a.mime.startsWith("video/") ? "video" : "image", {
                          src: url,
                        })
                      }
                    >
                      Thêm
                    </button>
                  )}
                  <button
                    onClick={() =>
                      navigator.clipboard
                        .writeText(url)
                        .then(() => message("Đã sao chép đường dẫn file."))
                        .catch(() => message("Đường dẫn: " + url))
                    }
                  >
                    Link
                  </button>
                  <button
                    aria-label={"Xóa file " + a.original_name}
                    disabled={used || a.original}
                    onClick={() => {
                      if (confirm("Xóa file " + a.original_name + "?"))
                        cleanup(a.id);
                    }}
                  >
                    ×
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </>
  );
}
export function PresetPanel({ doc, change, message }: any) {
  const [items, setItems] = useState([]),
    [name, setName] = useState("");
  async function load() {
    const r = await fetch("/api/editor/presets");
    if (r.ok) setItems((await r.json()).presets);
  }
  useEffect(() => {
    load();
  }, []);
  async function save() {
    try {
      const r = await fetch("/api/editor/presets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "save", name, document: doc }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setName("");
      await load();
      message("Đã lưu preset của bạn.");
    } catch (e) {
      message(e.message);
    }
  }
  async function apply(id) {
    try {
      const r = await fetch("/api/editor/presets?id=" + id);
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      if (
        confirm("Đưa preset này vào bản nháp? Thiệp khách xem chưa thay đổi.")
      )
        change((target) => {
          Object.keys(target).forEach((k) => delete target[k]);
          Object.assign(target, d.preset.document);
        });
    } catch (e) {
      message(e.message);
    }
  }
  return (
    <>
      <h2>Preset</h2>
      <h3>Bảng màu có sẵn</h3>
      <div className="studio-presets">
        {PALETTES.map((p) => (
          <button
            aria-label={p.name}
            key={p.id}
            onClick={() =>
              change((d) => {
                d.theme.primary = p.primary;
                d.theme.background = p.background;
              })
            }
          >
            <span style={{ background: p.background, borderColor: p.primary }}>
              <i style={{ background: p.primary }} />
              Aa
            </span>
            {p.name}
          </button>
        ))}
      </div>
      <h3>Preset của tôi</h3>
      <Field label="Tên preset mới" value={name} onChange={setName} />
      <button onClick={save}>Lưu thiệp hiện tại thành preset</button>
      {items.map((p) => (
        <section className="ed-card" key={p.id}>
          <strong>{p.name}</strong>
          <div className="studio-row">
            <button onClick={() => apply(p.id)}>Dùng preset</button>
            <button
              onClick={async () => {
                if (!confirm("Xóa preset " + p.name + "?")) return;
                const r = await fetch("/api/editor/presets", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ action: "delete", id: p.id }),
                });
                if (r.ok) load();
                else message("Không thể xóa preset.");
              }}
            >
              Xóa
            </button>
          </div>
        </section>
      ))}
    </>
  );
}
export function EffectsPanel({ doc, change, go }: any) {
  return (
    <>
      <h2>Hiệu ứng</h2>
      <div className="studio-option">
        <span className="studio-option-icon">♡</span>
        <div>
          <b>Tim bay</b>
          <p>Hiệu ứng bay nhẹ trên trang.</p>
        </div>
        <input
          aria-label="Bật tim bay"
          type="checkbox"
          checked={doc.theme.effects}
          onChange={(e) =>
            change((d) => {
              d.theme.effects = e.target.checked;
            })
          }
        />
      </div>
      {doc.theme.effects && (
        <Field
          label="Biểu tượng bay (cách nhau bằng khoảng trắng)"
          value={doc.theme.effectSymbols}
          onChange={(v) =>
            change((d) => {
              d.theme.effectSymbols = v;
            })
          }
        />
      )}
      <button className="studio-option" onClick={() => go("opening")}>
        <span className="studio-option-icon">✧</span>
        <div>
          <b>Hiệu ứng mở màn</b>
          <p>Phong bì, lời mời và ảnh trang trí.</p>
        </div>
        <span>›</span>
      </button>
      <button className="studio-option" onClick={() => go("background")}>
        <span className="studio-option-icon">◈</span>
        <div>
          <b>Đổi màu toàn thiệp</b>
          <p>Chọn bảng màu và nền phù hợp.</p>
        </div>
        <span>›</span>
      </button>
    </>
  );
}
export function BackgroundPanel({ doc, change, mediaProps }: any) {
  return (
    <>
      <h2>Nền & màu sắc</h2>
      <Field
        label="Màu chủ đạo toàn thiệp"
        type="color"
        value={doc.theme.primary}
        onChange={(v) =>
          change((d) => {
            const old = d.theme.primary;
            d.theme.primary = v;
            for (const n of Object.values<any>(d.nodes))
              for (const key of ["color", "backgroundColor"])
                if (n.style?.[key] === old) n.style[key] = v;
          })
        }
      />
      <Field
        label="Màu nền toàn thiệp"
        type="color"
        value={doc.theme.background}
        onChange={(v) =>
          change((d) => {
            d.theme.background = v;
          })
        }
      />
      <Media
        label="Ảnh nền toàn thiệp"
        value={doc.theme.backgroundImage}
        onChange={(v) =>
          change((d) => {
            d.theme.backgroundImage = v;
          })
        }
        {...mediaProps}
      />
      <button
        onClick={() =>
          change((d) => {
            d.theme.backgroundImage = "";
          })
        }
      >
        Bỏ ảnh nền
      </button>
      <h3>Chọn nhanh</h3>
      <div className="studio-presets">
        {PALETTES.map((p) => (
          <button
            aria-label={p.name}
            key={p.id}
            onClick={() =>
              change((d) => {
                d.theme.primary = p.primary;
                d.theme.background = p.background;
              })
            }
          >
            <span style={{ background: p.background, borderColor: p.primary }}>
              <i style={{ background: p.primary }} />
              Aa
            </span>
            {p.name}
          </button>
        ))}
      </div>
    </>
  );
}
export function ShareQR({ doc }: any) {
  const [guest, setGuest] = useState(""),
    [qr, setQr] = useState(""),
    [error, setError] = useState("");
  const base = typeof location === "undefined" ? "" : location.origin;
  const url =
    base +
    "/i/" +
    doc.site.slug +
    (guest ? "?guest=" + encodeURIComponent(guest) : "");
  useEffect(() => {
    let live = true;
    const timer = setTimeout(
      () =>
        import("qrcode")
          .then((m) =>
            (m.default || m).toDataURL(url, {
              width: 280,
              margin: 2,
              errorCorrectionLevel: "M",
            }),
          )
          .then((data) => {
            if (live) {
              setQr(data);
              setError("");
            }
          })
          .catch(() => {
            if (live) setError("Không tạo được QR.");
          }),
      180,
    );
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [url]);
  return (
    <section className="ed-card studio-qr">
      <h3>Mã QR chia sẻ</h3>
      <Field
        label="Tên khách trong link (không bắt buộc)"
        value={guest}
        onChange={setGuest}
      />
      <input aria-label="Link chia sẻ thiệp" readOnly value={url} />
      {qr && <img src={qr} alt="QR mở thiệp" />}
      {error && <p>{error}</p>}
      <div className="studio-row">
        <button
          onClick={() => navigator.clipboard.writeText(url).catch(() => {})}
        >
          Sao chép link
        </button>
        {qr && (
          <a href={qr} download="ma-qr-thiep-cuoi.png">
            Tải QR PNG ↓
          </a>
        )}
      </div>
      <p className="ed-help">
        Link dùng slug đang chỉnh. Bấm Áp dụng trước khi chia sẻ slug mới.
      </p>
    </section>
  );
}
export function SettingsPanel({ doc, change, go }: any) {
  return (
    <>
      <h2>Cài đặt</h2>
      <Field
        label="Tên khách mặc định"
        value={doc.site.guestName}
        onChange={(v) =>
          change((d) => {
            d.site.guestName = v;
            d.opening.invite = v;
          })
        }
      />
      <p className="ed-help">Tên hiển thị khi link không có tên khách riêng.</p>
      <Field
        label="Slug đường dẫn thiệp"
        value={doc.site.slug}
        onChange={(v) =>
          change((d) => {
            d.site.slug = v;
          })
        }
      />
      <label className="studio-option">
        <span>♫</span>
        <b>Mở tự động chạy nhạc</b>
        <input
          aria-label="Mở tự động chạy nhạc"
          type="checkbox"
          checked={doc.site.autoPlay}
          onChange={(e) =>
            change((d) => {
              d.site.autoPlay = e.target.checked;
            })
          }
        />
      </label>
      <label className="studio-option">
        <span>▣</span>
        <b>Bật màn PC (Desktop)</b>
        <input
          aria-label="Bật màn PC"
          type="checkbox"
          checked={doc.site.desktop}
          onChange={(e) =>
            change((d) => {
              d.site.desktop = e.target.checked;
            })
          }
        />
      </label>
      <p className="ed-help">
        Màn PC phóng thiệp rộng hơn trên màn hình từ 900px. Thiết bị vẫn có thể
        yêu cầu bạn bấm mở thiệp trước khi phát nhạc.
      </p>
      <ShareQR doc={doc} />
      <div className="studio-row">
        <button onClick={() => go("content")}>Thông tin đôi bạn</button>
        <button onClick={() => go("events")}>Hai lễ cưới</button>
        <button onClick={() => go("forms")}>RSVP & lời chúc</button>
        <button onClick={() => go("gifts")}>Nhạc & quà mừng</button>
        <button onClick={() => go("theme")}>Font & kích thước</button>
        <button onClick={() => go("history")}>Lịch sử áp dụng</button>
      </div>
    </>
  );
}
export function StatsPanel({ message }: any) {
  const [data, setData] = useState(null),
    [kind, setKind] = useState("all");
  async function load() {
    try {
      const r = await fetch("/api/editor/stats", { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      setData(d);
    } catch (e) {
      message(e.message);
    }
  }
  useEffect(() => {
    load();
  }, []);
  async function action(body) {
    try {
      const r = await fetch("/api/editor/stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error);
      await load();
    } catch (e) {
      message(e.message);
    }
  }
  function csv() {
    const rows = [
      [
        "Loại",
        "Tên",
        "Điện thoại",
        "Email",
        "Sản phẩm",
        "Số lượng",
        "Tổng tiền VND",
        "Lời nhắn",
        "Trạng thái",
        "Ngày gửi UTC",
      ],
      ...data.submissions.map((s) => [
        s.kind,
        s.name,
        s.phone,
        s.email,
        s.product,
        s.quantity,
        s.total,
        s.note,
        s.status,
        s.created,
      ]),
    ];
    const quote = (value) =>
      '"' +
      String(/^\s*[=+@-]/.test(String(value)) ? "'" + value : value).replaceAll(
        '"',
        '""',
      ) +
      '"';
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob(
        ["\ufeff" + rows.map((r) => r.map(quote).join(",")).join("\r\n")],
        { type: "text/csv;charset=utf-8" },
      ),
    );
    a.download = "bieu-mau-thiep.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }
  if (!data)
    return (
      <>
        <h2>Thống kê</h2>
        <p>Đang tải dữ liệu…</p>
        <button onClick={load}>Tải lại</button>
      </>
    );
  const max = Math.max(1, ...data.daily.map((d) => d.views));
  return (
    <>
      <div className="ed-heading">
        <h2>Thống kê</h2>
        <button onClick={load}>↻</button>
      </div>
      <div className="studio-stat-grid">
        {[
          ["Lượt xem", data.visits.views],
          ["Khách truy cập", data.visits.visitors],
          ["Phản hồi RSVP", data.rsvp.replies],
          ["Khách dự kiến", data.rsvp.guests],
          ["Lời chúc", data.wishes.total],
          ["Chờ duyệt", data.wishes.pending || 0],
        ].map(([l, n]) => (
          <div key={l}>
            <small>{l}</small>
            <strong>{n}</strong>
          </div>
        ))}
      </div>
      <h3>Lượt xem 14 ngày gần nhất</h3>
      {data.daily.length ? (
        <div className="studio-bars">
          {data.daily.map((d) => (
            <div key={d.day}>
              <small>{d.day.slice(5)}</small>
              <span style={{ width: Math.max(3, (d.views / max) * 140) }} />
              <b>{d.views}</b>
            </div>
          ))}
        </div>
      ) : (
        <p className="ed-help">
          Chưa có lượt xem được ghi nhận. Chế độ chỉnh sửa không tính vào thống
          kê.
        </p>
      )}
      <a className="studio-dashboard-link" href="/admin">
        Quản lý RSVP & lời chúc ↗
      </a>
      <h3>Đăng ký & yêu cầu đặt hàng</h3>
      <select
        aria-label="Lọc biểu mẫu"
        value={kind}
        onChange={(e) => setKind(e.target.value)}
      >
        <option value="all">Tất cả ({data.submissions.length})</option>
        <option value="registration">Đăng ký</option>
        <option value="order">Đặt hàng</option>
      </select>
      <button onClick={csv}>Xuất CSV biểu mẫu ↓</button>
      {data.submissions
        .filter((s) => kind === "all" || s.kind === kind)
        .map((s) => (
          <section className="ed-card studio-submission" key={s.id}>
            <strong>{s.name}</strong>
            <small>
              {s.kind === "order" ? "Yêu cầu đặt hàng" : "Đăng ký"} ·{" "}
              {s.created} UTC
            </small>
            <p>
              {s.phone}
              {s.email ? " · " + s.email : ""}
            </p>
            {s.kind === "order" && (
              <p>
                {s.product} × {s.quantity} ·{" "}
                {new Intl.NumberFormat("vi-VN").format(s.total)} đ
              </p>
            )}
            <p>{s.note}</p>
            <div className="studio-row">
              <select
                aria-label={"Trạng thái phản hồi " + s.id}
                value={s.status}
                onChange={(e) =>
                  action({ action: "status", id: s.id, status: e.target.value })
                }
              >
                <option value="new">Mới nhận</option>
                <option value="confirmed">Đã xác nhận</option>
                <option value="cancelled">Đã hủy</option>
              </select>
              <button
                onClick={() => {
                  if (confirm("Xóa phản hồi của " + s.name + "?"))
                    action({ action: "delete", id: s.id });
                }}
              >
                Xóa
              </button>
            </div>
          </section>
        ))}
      {!data.submissions.length && (
        <p className="ed-help">Chưa có đăng ký hoặc yêu cầu đặt hàng.</p>
      )}
    </>
  );
}
export function WidgetProperties({ value, patch, mediaProps }: any) {
  const p = value.props || {},
    change = (key, v) => patch({ props: { ...p, [key]: v } });
  return (
    <div className="studio-widget-properties">
      {value.type === "video" && (
        <>
          <Media
            label="Video MP4"
            value={value.src || ""}
            kind="video"
            onChange={(v) => patch({ src: v })}
            {...mediaProps}
          />
          <Media
            label="Ảnh đại diện video"
            value={p.poster || ""}
            onChange={(v) => change("poster", v)}
            {...mediaProps}
          />
          <label className="ed-check">
            <input
              type="checkbox"
              checked={!!p.autoplay}
              onChange={(e) => change("autoplay", e.target.checked)}
            />
            Tự phát video (tắt tiếng)
          </label>
        </>
      )}
      {value.type === "icon" && (
        <Field
          label="Biểu tượng / emoji"
          value={value.text}
          onChange={(v) => patch({ text: v })}
        />
      )}
      {["directions", "map"].includes(value.type) && (
        <Field
          label="Địa chỉ trên bản đồ"
          multiline
          value={p.address || ""}
          onChange={(v) => change("address", v)}
        />
      )}
      {["calendar", "countdown"].includes(value.type) && (
        <Field
          type="datetime-local"
          label="Ngày giờ thành phần"
          value={p.date || ""}
          onChange={(v) => change("date", v)}
        />
      )}
      {value.type === "call" && (
        <Field
          type="tel"
          label="Số điện thoại được gọi"
          value={p.phone || ""}
          onChange={(v) => change("phone", v)}
        />
      )}
      {value.type === "chat" && (
        <Field
          label="Link Zalo / Messenger"
          value={p.url || ""}
          onChange={(v) => change("url", v)}
        />
      )}
      {value.type === "collapse" && (
        <Field
          multiline
          label="Nội dung thu gọn"
          value={p.body || ""}
          onChange={(v) => change("body", v)}
        />
      )}
      {value.type === "social" && (
        <Field
          multiline
          label="Mạng xã hội (Tên | Link, mỗi dòng một mục)"
          value={(p.links || []).map((x) => x.label + " | " + x.url).join("\n")}
          onChange={(v) =>
            change(
              "links",
              v.split("\n").map((line) => {
                const [label, ...url] = line.split("|");
                return { label: label.trim(), url: url.join("|").trim() };
              }),
            )
          }
        />
      )}
      {value.type === "timeline" && (
        <Field
          multiline
          label="Lịch trình (Giờ | Nội dung, mỗi dòng một mục)"
          value={(p.items || [])
            .map((x) => x.time + " | " + x.label)
            .join("\n")}
          onChange={(v) =>
            change(
              "items",
              v.split("\n").map((line) => {
                const [time, ...label] = line.split("|");
                return { time: time.trim(), label: label.join("|").trim() };
              }),
            )
          }
        />
      )}
      {value.type === "album" && (
        <Field
          multiline
          label="Ảnh trong khối album (mỗi dòng một URL)"
          value={(p.images || []).join("\n")}
          onChange={(v) =>
            change(
              "images",
              v
                .split("\n")
                .map((x) => x.trim())
                .filter(Boolean),
            )
          }
        />
      )}
      {["registration", "order", "login"].includes(value.type) && (
        <>
          <Field
            label="Chữ nút biểu mẫu"
            value={p.button || ""}
            onChange={(v) => change("button", v)}
          />
          {value.type !== "login" && (
            <Field
              multiline
              label="Mô tả biểu mẫu"
              value={p.description || ""}
              onChange={(v) => change("description", v)}
            />
          )}
        </>
      )}
      {value.type === "order" && (
        <>
          <Field
            label="Tên sản phẩm / dịch vụ"
            value={p.product || ""}
            onChange={(v) => change("product", v)}
          />
          <Field
            type="number"
            min="0"
            max="1000000000"
            label="Đơn giá (VND)"
            value={p.unitPrice || 0}
            onChange={(v) => change("unitPrice", Number(v) || 0)}
          />
          <p className="ed-help">
            Đây là yêu cầu đặt hàng; quản trị xác nhận sau khi nhận. Tổng tiền
            do máy chủ tính.
          </p>
        </>
      )}
      {value.type === "gift" && (
        <label className="ed-field">
          <span>Bên nhận quà</span>
          <select
            value={p.side || "groom"}
            onChange={(e) => change("side", e.target.value)}
          >
            <option value="groom">Chú rể</option>
            <option value="bride">Cô dâu</option>
          </select>
        </label>
      )}
      {value.type === "guest" && (
        <p className="ed-help">
          Hiển thị tên từ ?guest= trong link; nếu không có sẽ dùng tên khách mặc
          định trong Cài đặt.
        </p>
      )}
      {["wishes", "rsvp"].includes(value.type) && (
        <p className="ed-help">
          Dữ liệu gửi về cùng backend đang dùng. Sửa tiêu đề, danh sách sự kiện
          ở mục Biểu mẫu.
        </p>
      )}
    </div>
  );
}
