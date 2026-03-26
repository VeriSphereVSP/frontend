// Verity Score color bar — green for positive, red for negative, gray for zero
export default function VSBar({ vs, width = 80, height = 20 }: { vs: number; width?: number; height?: number }) {
  const clamped = Math.max(-100, Math.min(100, vs));
  const absVs = Math.abs(clamped);
  const isPos = clamped > 0;
  const isNeg = clamped < 0;
  const fillPct = Math.max(absVs, 2); // minimum 2% so zero still shows the bar outline

  // Colors
  const green = "#16a34a";
  const red = "#dc2626";
  const gray = "#d1d5db";
  const fillColor = isPos ? green : isNeg ? red : gray;
  const textColor = absVs > 30 ? "#fff" : "#374151";

  return (
    <div
      style={{
        width,
        height,
        borderRadius: 3,
        background: "#f3f4f6",
        position: "relative",
        overflow: "hidden",
        border: "1px solid #e5e7eb",
        flexShrink: 0,
      }}
      title={`VS: ${clamped > 0 ? "+" : ""}${clamped.toFixed(1)}%`}
    >
      {/* Fill */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: isNeg ? undefined : 0,
          right: isNeg ? 0 : undefined,
          width: `${fillPct}%`,
          height: "100%",
          background: fillColor,
          borderRadius: 2,
          transition: "width 0.3s ease",
        }}
      />
      {/* Label */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: height > 16 ? 10 : 8,
          fontWeight: 700,
          color: textColor,
          zIndex: 1,
          userSelect: "none",
        }}
      >
        {clamped > 0 ? "+" : ""}{clamped.toFixed(1)}%
      </div>
    </div>
  );
}
