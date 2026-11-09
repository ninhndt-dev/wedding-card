import { Field, Media } from "./fields";
import type { Asset, WeddingDocument } from "../../lib/types";

interface AlbumEditorProps {
  photos: WeddingDocument["album"];
  change: (update: (document: WeddingDocument) => void) => void;
  upload: (file: File) => Promise<string | null>;
  assets: Asset[];
  busy: boolean;
}

export function AlbumEditor({
  photos,
  change,
  upload,
  assets,
  busy,
}: AlbumEditorProps) {
  const mediaProps = { upload, assets };
  return (
    <div className="ed-album-photos" aria-label="Chỉnh sửa từng ảnh album">
      {photos.map((photo, i) => (
        <section key={i} className="ed-card">
          <div className="ed-heading">
            <h3>Ảnh {i + 1}</h3>
            <div>
              <button
                aria-label={"Đưa ảnh " + (i + 1) + " lên"}
                disabled={busy || !i}
                onClick={() =>
                  change((d) => {
                    [d.album[i - 1], d.album[i]] = [d.album[i], d.album[i - 1]];
                  })
                }
              >
                ↑
              </button>
              <button
                aria-label={"Đưa ảnh " + (i + 1) + " xuống"}
                disabled={busy || i === photos.length - 1}
                onClick={() =>
                  change((d) => {
                    [d.album[i], d.album[i + 1]] = [d.album[i + 1], d.album[i]];
                  })
                }
              >
                ↓
              </button>
              <button
                disabled={busy}
                aria-label={"Xóa ảnh " + (i + 1)}
                onClick={() => change((d) => d.album.splice(i, 1))}
              >
                ×
              </button>
            </div>
          </div>
          <Media
            label={"Ảnh album " + (i + 1)}
            value={photo.src}
            onChange={(v) =>
              change((d) => {
                d.album[i].src = v;
              })
            }
            {...mediaProps}
          />
          <Field
            label={"Chú thích ảnh " + (i + 1)}
            value={photo.caption}
            onChange={(v) =>
              change((d) => {
                d.album[i].caption = v;
              })
            }
          />
        </section>
      ))}
      <button
        disabled={busy || photos.length >= 100}
        onClick={() =>
          change((d) =>
            d.album.push({
              src: "/thiep-01/1793892037600-HIU_7932.webp",
              caption: "",
            }),
          )
        }
      >
        + Thêm ảnh album
      </button>
    </div>
  );
}
