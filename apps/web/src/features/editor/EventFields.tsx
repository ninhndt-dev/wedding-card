import { Field } from "./fields";

export function EventFields({
  value,
  onChange,
}: {
  value: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  return (
    <>
      <Field
        label="Ngày bữa cơm thân mật"
        type="date"
        value={value.date || ""}
        onChange={(v) => onChange("date", v)}
      />
      <Field
        label="Ngày âm bữa cơm thân mật"
        value={value.lunar || ""}
        placeholder="(Tức ngày … tháng … năm …)"
        onChange={(v) => onChange("lunar", v)}
      />
      {(
        [
          ["groom", "Nhà trai"],
          ["bride", "Nhà gái"],
        ] as const
      ).map(([side, label]) => (
        <section className="ed-card" key={side}>
          <h3>{label}</h3>
          <Field
            label={"Giờ bữa cơm · " + label}
            type="time"
            value={value[side + "Time"] || ""}
            onChange={(v) => onChange(side + "Time", v)}
          />
          <Field
            label={"Địa điểm bữa cơm · " + label}
            value={value[side + "Venue"] || ""}
            placeholder="Để trống để dùng địa điểm của lễ cưới"
            onChange={(v) => onChange(side + "Venue", v)}
          />
          <Field
            label={"Địa chỉ bữa cơm · " + label}
            multiline
            value={value[side + "Address"] || ""}
            placeholder="Để trống để dùng địa chỉ của lễ cưới"
            onChange={(v) => onChange(side + "Address", v)}
          />
          <Field
            label={"Bản đồ bữa cơm · " + label}
            value={value[side + "MapUrl"] || ""}
            onChange={(v) => onChange(side + "MapUrl", v)}
          />
        </section>
      ))}
      <p className="ed-help">
        Mỗi link thiệp lấy thông tin nhà trai/nhà gái theo cột Bên mời trong
        file khách mời.
      </p>
    </>
  );
}
