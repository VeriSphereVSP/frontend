// Verity Score color bar — green for positive, red for negative, gray for zero
// Label renders OUTSIDE the fill (in VS color) when fill is narrow, INSIDE (white) when wide
export default function VSBar({ vs, width = 56, height = 20 }: { vs: number; width?: number; height?: number }) {
  const clamped = Math.max(-100, Math.min(100, vs));
  const absVs = Math.abs(clamped);
  const isPos = clamped > 0;
  const isNeg = clamped < 0;
  const fillPct = Math.max(absVs, 2);
  const green = "#16a34a";
  const red = "#dc2626";
  const gray = "#d1d5db";
  const fillColor = isPos ? green : isNeg ? red : gray;
  // When fill is wide enough, white text inside. Otherwise, colored text outside.
  const labelInside = absVs > 35;
  const textColor = labelInside ? "#fff" : fillColor;
  const label = `${clamped > 0 ? "+" : ""}${clamped.toFixed(1)}%`;
  return (
    <div
      style={{
        width, height, borderRadius: 3, background: "#f3f4f6",
        position: "relative", overflow: "hidden",
        border: "1px solid #e5e7eb", flexShrink: 0,
      }}
      title={`VS: ${label}`}
    >
      <div
        style={{
          position: "absolute", top: 0,
          left: isNeg ? undefined : 0,
          right: isNeg ? 0 : undefined,
          width: `${fillPct}%`, height: "100%",
          background: fillColor, borderRadius: 2,
          transition: "width 0.3s ease",
        }}
      />
      <div
        style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center",
          // When inside: center. When outside: opposite side from the fill
          // (positive fill is on left, so label goes right; negative fill on right, label goes left)
          justifyContent: labelInside ? "center" : (isPos ? "flex-end" : "flex-start"),
          paddingLeft: labelInside || isPos ? 0 : 3,
          paddingRight: labelInside || isNeg ? 0 : 3,
          fontSize: height > 16 ? 10 : 9, fontWeight: 600,
          color: textColor, zIndex: 1, userSelect: "none",
          whiteSpace: "nowrap" as const,
        }}
      >
        {label}
      </div>
    </div>
  );
}
