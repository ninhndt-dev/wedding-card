import type { ImageCrop } from "../../lib/types";

export function ImageCropControls({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: ImageCrop;
  onChange: (crop: ImageCrop) => void;
}) {
  const crop = { zoom: 100, x: 0, y: 0, ...value };
  const zoom = (delta: number) =>
    onChange({ ...crop, zoom: Math.max(50, Math.min(400, crop.zoom + delta)) });
  return (
    <fieldset className="ed-image-crop">
      <legend>{label}</legend>
      {(
        [
          ["zoom", "Zoom (%)", 50, 400],
          ["x", "Dịch ngang (%)", -100, 100],
          ["y", "Dịch dọc (%)", -100, 100],
        ] as const
      ).map(([key, title, min, max]) => (
        <label className="ed-field" key={key}>
          <span>
            {title}: {crop[key]}%
          </span>
          <input
            type="range"
            aria-label={label + ": " + title}
            min={min}
            max={max}
            step={1}
            value={crop[key]}
            onChange={(e) =>
              onChange({ ...crop, [key]: Number(e.target.value) })
            }
          />
        </label>
      ))}
      <div className="ed-crop-actions">
        <button
          type="button"
          aria-label={label + ": Thu nhỏ"}
          onClick={() => zoom(-10)}
        >
          −
        </button>
        <button
          type="button"
          aria-label={label + ": Phóng to"}
          onClick={() => zoom(10)}
        >
          ＋
        </button>
        <button
          type="button"
          onClick={() => onChange({ zoom: 100, x: 0, y: 0 })}
        >
          Đặt lại canh ảnh
        </button>
      </div>
    </fieldset>
  );
}
