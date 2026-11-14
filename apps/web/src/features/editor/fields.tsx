import { useRef, useState } from "react";
import { mediaPreview } from "../../lib/media-preview";
const asUrl = (v) => (v?.startsWith("./") ? "/thiep-01/" + v.slice(2) : v);
export function Field({
  label,
  value,
  onChange,
  type = "text",
  multiline = false,
  ...props
}: any) {
  return (
    <label className="ed-field">
      <span>{label}</span>
      {multiline ? (
        <textarea
          aria-label={label}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          {...props}
        />
      ) : (
        <input
          aria-label={label}
          type={type}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          {...props}
        />
      )}
    </label>
  );
}
export function Media({
  label,
  value,
  onChange,
  upload,
  assets,
  kind = "image",
}: any) {
  const file = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState("");
  const choices = assets.filter((a) => a.mime?.startsWith(kind + "/"));
  return (
    <div className="ed-media">
      <Field label={label} value={value} onChange={onChange} />
      {kind === "image" && value && (
        <img
          src={mediaPreview(asUrl(value))}
          loading="lazy"
          decoding="async"
          alt="Xem trước ảnh"
        />
      )}
      {kind === "audio" && value && (
        <audio
          controls
          src={asUrl(value)}
          style={{ width: "100%", marginBottom: 10 }}
        />
      )}
      {kind === "video" && value && (
        <video
          src={asUrl(value)}
          controls
          style={{ width: "100%", maxHeight: 150 }}
        />
      )}
      <div className="ed-media-actions">
        <button
          type="button"
          disabled={uploading}
          onClick={() => file.current?.click()}
        >
          ↑ Tải{" "}
          {{ image: "ảnh", audio: "nhạc", font: "font", video: "video" }[kind]}
        </button>
        <input
          ref={file}
          hidden
          type="file"
          accept={kind === "font" ? ".ttf,.otf,.woff2" : kind + "/*"}
          onChange={async (e) => {
            const input = e.currentTarget;
            const f = input.files?.[0];
            if (!f) return;
            setUploading(true);
            try {
              const url = await upload(f, setStatus);
              if (url) onChange(url);
            } finally {
              input.value = "";
              setUploading(false);
            }
          }}
        />
        <select
          aria-label={"Thư viện: " + label}
          value=""
          onChange={(e) => {
            if (e.target.value) onChange(e.target.value);
          }}
        >
          <option value="">Chọn từ thư viện</option>
          {choices.map((a) => (
            <option key={a.id} value={a.url || "/media/" + a.filename}>
              {a.original_name || a.filename}
            </option>
          ))}
        </select>
      </div>
      {status && (
        <p
          className="ed-help"
          role="status"
          aria-label={"Trạng thái tải: " + label}
        >
          {status}
        </p>
      )}
    </div>
  );
}
