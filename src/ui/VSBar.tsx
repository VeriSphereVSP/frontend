export default function VSBar({ evs }: { evs?: number }) {
  const value = evs ?? 0;
  const pct = ((value + 100) / 200) * 100;

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 12, marginBottom: 4 }}>
        eVS: {value.toFixed(1)}
      </div>
      <div style={{ height: 6, background: "#eee", borderRadius: 4 }}>
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: "#111",
            borderRadius: 4,
          }}
        />
      </div>
    </div>
  );
}

