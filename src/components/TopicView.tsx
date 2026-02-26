// frontend/src/components/TopicView.tsx
// View 1: Incumbent vs Challenger — two columns with paired rows
import { useState, useCallback } from "react";
import ClaimModal from "./ClaimModal";

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

type ClaimData = {
  text: string;
  post_id?: number | null;
  on_chain?: any;
  stake_support?: number;
  stake_challenge?: number;
  verity_score?: number;
  user_support?: number;
  user_challenge?: number;
  source?: string;
  author?: string;
  confidence?: number;
};

type TopicRow = {
  incumbent: ClaimData | null;
  challengers: ClaimData[];
};

const DUST = 0.001;
function clean(n: number | undefined): number {
  const v = n ?? 0;
  return Math.abs(v) < DUST ? 0 : v;
}

function vsColor(vs: number, side: "incumbent" | "challenger"): string {
  if (side === "challenger") {
    const intensity = Math.min(0.2, (Math.abs(vs) / 100) * 0.2);
    return `rgba(220, 50, 50, ${Math.max(0.04, intensity)})`;
  }
  if (vs > 0) {
    const intensity = Math.min(0.25, (vs / 100) * 0.25);
    return `rgba(0, 200, 80, ${intensity})`;
  }
  return "transparent";
}

function vsBadge(vs: number, isOnChain: boolean): React.CSSProperties {
  let bg = "#ddd";
  let color = "#888";
  if (isOnChain) {
    if (vs > 0) {
      bg = `rgba(0, 180, 70, ${0.3 + Math.min(0.7, (vs / 100) * 0.7)})`;
      color = "#fff";
    } else if (vs < 0) {
      bg = `rgba(220, 50, 50, ${0.3 + Math.min(0.7, (Math.abs(vs) / 100) * 0.7)})`;
      color = "#fff";
    } else {
      bg = "#6b7280";
      color = "#fff";
    }
  }
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: 42,
    height: 26,
    borderRadius: 13,
    fontSize: 11,
    fontWeight: 700,
    background: bg,
    color,
    cursor: "pointer",
    border: "none",
    marginRight: 8,
    flexShrink: 0,
  };
}

function ClaimPill({
  claim,
  side,
  onClick,
}: {
  claim: ClaimData;
  side: "incumbent" | "challenger";
  onClick: () => void;
}) {
  const vs = clean(claim.verity_score);
  const isOnChain = claim.on_chain?.post_id != null || claim.post_id != null;

  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "flex-start",
        padding: "8px 12px",
        borderRadius: 8,
        background: vsColor(vs, side),
        border: `1px solid ${side === "challenger" ? "rgba(220,50,50,0.12)" : "rgba(0,0,0,0.05)"}`,
        cursor: "pointer",
        gap: 0,
      }}
    >
      <div style={vsBadge(vs, isOnChain)}>
        {isOnChain ? (vs > 0 ? "+" : "") + vs.toFixed(0) : "—"}
      </div>
      <span style={{ fontSize: 13, lineHeight: 1.45, flex: 1 }}>
        {claim.text}
      </span>
      {isOnChain && (
        <span
          style={{
            fontSize: 9,
            color: "#aaa",
            marginLeft: 6,
            alignSelf: "center",
          }}
        >
          ⛓
        </span>
      )}
    </div>
  );
}

export default function TopicView({
  rows: initialRows,
  title,
}: {
  rows: TopicRow[];
  title?: string;
}) {
  const [rows, setRows] = useState<TopicRow[]>(initialRows);
  const [pinnedClaim, setPinnedClaim] = useState<any | null>(null);
  const [pinnedLoc, setPinnedLoc] = useState<{
    rowIdx: number;
    side: "incumbent" | "challenger";
    chIdx?: number;
  } | null>(null);

  // Check if any row has challengers — if not, hide the column entirely
  const hasAnyChallengers = rows.some((r) => r.challengers.length > 0);

  const refreshClaim = useCallback(
    async (text: string, rowIdx: number, side: string, chIdx?: number) => {
      try {
        const res = await fetch(
          `${API_BASE}/claim-status/${encodeURIComponent(text)}`,
        );
        if (!res.ok) return;
        const data = await res.json();
        setRows((prev) => {
          const next = prev.map((r) => ({
            incumbent: r.incumbent ? { ...r.incumbent } : null,
            challengers: r.challengers.map((c) => ({ ...c })),
          }));
          const row = next[rowIdx];
          if (!row) return prev;
          const patch: Partial<ClaimData> = {
            stake_support: data.stake_support ?? 0,
            stake_challenge: data.stake_challenge ?? 0,
            verity_score: data.verity_score ?? 0,
            on_chain: data.on_chain,
            post_id: data.on_chain?.post_id ?? null,
          };
          if (side === "incumbent" && row.incumbent)
            Object.assign(row.incumbent, patch);
          else if (
            side === "challenger" &&
            chIdx != null &&
            row.challengers[chIdx]
          )
            Object.assign(row.challengers[chIdx], patch);
          return next;
        });
      } catch {}
    },
    [],
  );

  const closeModal = () => {
    if (pinnedClaim && pinnedLoc) {
      refreshClaim(
        pinnedClaim.text,
        pinnedLoc.rowIdx,
        pinnedLoc.side,
        pinnedLoc.chIdx,
      );
    }
    setPinnedClaim(null);
    setPinnedLoc(null);
  };

  const open = (
    claim: ClaimData,
    rowIdx: number,
    side: "incumbent" | "challenger",
    chIdx?: number,
  ) => {
    setPinnedClaim({
      text: claim.text,
      on_chain: claim.on_chain,
      stake_support: claim.stake_support ?? 0,
      stake_challenge: claim.stake_challenge ?? 0,
      verity_score: claim.verity_score ?? 0,
      author: claim.author ?? "AI Search",
      confidence: claim.confidence ?? 0,
    });
    setPinnedLoc({ rowIdx, side, chIdx });
  };

  if (!rows || rows.length === 0) {
    return <div className="card muted">No claims found for this topic.</div>;
  }

  // Grid: incumbent takes remaining space, challenger auto-sizes (min 200px if present)
  const gridCols = hasAnyChallengers ? "1fr minmax(200px, auto)" : "1fr";

  return (
    <div className="card" style={{ padding: "20px 16px" }}>
      {/* Column headers */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: gridCols,
          gap: 12,
          marginBottom: 10,
        }}
      >
        <div
          style={{
            textAlign: "center",
            fontSize: 12,
            fontWeight: 700,
            color: "#006622",
            textTransform: "uppercase",
            letterSpacing: 1,
            padding: "6px 0",
            borderBottom: "2px solid rgba(0,180,70,0.3)",
          }}
        >
          Incumbent
        </div>
        {hasAnyChallengers && (
          <div
            style={{
              textAlign: "center",
              fontSize: 12,
              fontWeight: 700,
              color: "#8b0000",
              textTransform: "uppercase",
              letterSpacing: 1,
              padding: "6px 0",
              borderBottom: "2px solid rgba(220,50,50,0.3)",
            }}
          >
            Challenger
          </div>
        )}
      </div>

      {/* Rows */}
      {rows.map((row, i) => (
        <div
          key={i}
          style={{
            display: "grid",
            gridTemplateColumns: gridCols,
            gap: 12,
            marginBottom: 6,
            alignItems: "start",
          }}
        >
          {/* Incumbent */}
          <div>
            {row.incumbent ? (
              <ClaimPill
                claim={row.incumbent}
                side="incumbent"
                onClick={() => open(row.incumbent!, i, "incumbent")}
              />
            ) : (
              <div
                style={{
                  padding: "8px 12px",
                  borderRadius: 8,
                  background: "#fafafa",
                  border: "1px dashed #ddd",
                  color: "#bbb",
                  fontSize: 12,
                  textAlign: "center",
                  minHeight: 38,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                —
              </div>
            )}
          </div>

          {/* Challenger */}
          {hasAnyChallengers && (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {row.challengers.length > 0 ? (
                row.challengers.map((ch, j) => (
                  <ClaimPill
                    key={j}
                    claim={ch}
                    side="challenger"
                    onClick={() => open(ch, i, "challenger", j)}
                  />
                ))
              ) : (
                <div
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    background: "#fafafa",
                    border: "1px dashed #eee",
                    color: "#ccc",
                    fontSize: 12,
                    textAlign: "center",
                    minHeight: 38,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  No challenges
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Modal */}
      {pinnedClaim && (
        <div className="pinned-overlay" onClick={closeModal}>
          <div className="pinned-card" onClick={(e) => e.stopPropagation()}>
            <ClaimModal claim={pinnedClaim} onClose={closeModal} />
          </div>
        </div>
      )}
    </div>
  );
}
