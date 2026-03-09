// frontend/src/components/article/StakeInput.tsx
import { C } from "./theme";

/**
 * Numeric input with green ▲ (support) and red ▼ (challenge) arrow buttons.
 * Accepts signed values: positive = support, negative = challenge.
 */
export default function StakeInput({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
}) {
  const bump = (delta: number) => {
    const next = (parseFloat(value) || 0) + delta;
    onChange(String(delta > 0 ? Math.max(0, next) : next));
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        border: `1px solid ${C.gb}`,
        borderRadius: 4,
        overflow: "hidden",
        height: 24,
      }}
    >
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "" || v === "-" || /^-?\d*\.?\d*$/.test(v)) onChange(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit();
          if (e.key === "ArrowUp") {
            e.preventDefault();
            bump(1);
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            bump(-1);
          }
        }}
        placeholder="± VSP"
        style={{
          width: 44,
          padding: "2px 4px",
          border: "none",
          outline: "none",
          fontSize: 11,
          textAlign: "center",
          background: "transparent",
        }}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          borderLeft: `1px solid ${C.gb}`,
          height: "100%",
        }}
      >
        <button
          onClick={() => bump(1)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            padding: "0 5px",
            flex: 1,
            fontSize: 7,
            color: C.green,
            fontWeight: 700,
            borderBottom: `1px solid ${C.gb}`,
            lineHeight: 1,
          }}
          title="Increase (support)"
        >
          ▲
        </button>
        <button
          onClick={() => bump(-1)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            padding: "0 5px",
            flex: 1,
            fontSize: 7,
            color: C.red,
            fontWeight: 700,
            lineHeight: 1,
          }}
          title="Decrease (challenge)"
        >
          ▼
        </button>
      </div>
    </div>
  );
}
