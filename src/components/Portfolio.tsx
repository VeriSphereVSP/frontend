// frontend/src/components/Portfolio.tsx
import { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import { useStake } from "@verisphere/protocol";
import { InlineClaimCard } from "./ArticleView";
import { PlusButton } from "./article";

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

const triggerFullReindex = async (address: string) => {
  try {
    // Reindex all user positions
    await fetch(`${API_BASE}/reindex/0?user=${address}`, { method: "POST" });
  } catch (e) { /* non-fatal */ }
};

// ── Types ──────────────────────────────────────────────────

type Position = {
  post_id: number;
  post_type: "claim" | "link" | "unknown";
  text: string;
  user_support: number;
  user_challenge: number;
  user_total: number;
  user_net_side: "support" | "challenge" | "both";
  pool_support: number;
  pool_challenge: number;
  pool_total: number;
  verity_score: number;
  is_active: boolean;
  position_status: "winning" | "losing" | "neutral" | "hedged";
  estimated_apr: number;
  apr_breakdown?: {
    apr: number; r_min: number; r_max: number;
    vs: number; abs_vs: number; v: number;
    total_stake: number; s_max: number; participation: number;
    r_base?: number; r_eff: number; is_winner: boolean;
    tranche?: number; position_weight?: number; num_tranches?: number;
  };
  creator?: string;
  topic?: string;
};

type PortfolioData = {
  address: string;
  position_count: number;
  summary: {
    total_staked: number;
    total_support: number;
    total_challenge: number;
    winning_count: number;
    losing_count: number;
    weighted_apr: number;
    neutral_count: number;
  };
  positions: Position[];
};

// ── Colors ─────────────────────────────────────────────────

const C = {
  green: "#059669",
  greenLight: "rgba(5, 150, 105, 0.08)",
  greenMid: "rgba(5, 150, 105, 0.15)",
  red: "#dc2626",
  redLight: "rgba(220, 38, 38, 0.08)",
  redMid: "rgba(220, 38, 38, 0.15)",
  amber: "#d97706",
  amberLight: "rgba(217, 119, 6, 0.08)",
  gray: "#6b7280",
  grayLight: "#f3f4f6",
  grayBorder: "#e5e7eb",
  text: "#111827",
  textMuted: "#9ca3af",
  white: "#ffffff",
  blue: "#3b82f6",
  blueLight: "rgba(59, 130, 246, 0.08)",
};

// ── Helpers ────────────────────────────────────────────────

function statusColor(s: string) {
  if (s === "winning") return C.green;
  if (s === "losing") return C.red;
  if (s === "hedged") return C.amber;
  return C.gray;
}

function statusBg(s: string) {
  if (s === "winning") return C.greenLight;
  if (s === "losing") return C.redLight;
  if (s === "hedged") return C.amberLight;
  return C.grayLight;
}

function statusIcon(s: string) {
  if (s === "winning") return "▲";
  if (s === "losing") return "▼";
  if (s === "hedged") return "◆";
  return "—";
}

function vsColor(vs: number) {
  if (vs > 10) return C.green;
  if (vs < -10) return C.red;
  return C.gray;
}

function fmt(n: number) {
  return n % 1 === 0 ? n.toFixed(0) : n.toFixed(2);
}

// ── Stat Card ──────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 120,
        background: C.white,
        border: `1px solid ${C.grayBorder}`,
        borderRadius: 10,
        padding: "14px 16px",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: C.gray,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: color || C.text,
          lineHeight: 1.2,
        }}
      >
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ── Position Row ───────────────────────────────────────────

function PositionRow({ pos, onRefresh }: { pos: Position; onRefresh: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const sColor = statusColor(pos.position_status);
  const sBg = statusBg(pos.position_status);

  return (
    <div
      style={{
        background: C.white,
        border: `1px solid ${C.grayBorder}`,
        borderRadius: 10,
        marginBottom: 8,
        overflow: "hidden",
      }}
    >
      {/* Main row */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 16px",
          cursor: "pointer",
        }}
      >
        {/* Status icon */}
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            fontWeight: 700,
            background: sBg,
            color: sColor,
            flexShrink: 0,
          }}
        >
          {statusIcon(pos.position_status)}
        </div>

        {/* Text + type badge */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: C.text,
              lineHeight: 1.4,
              overflow: expanded ? "visible" : "hidden",
              textOverflow: expanded ? "unset" : "ellipsis",
              whiteSpace: expanded ? "normal" : "nowrap",
            }}
          >
            {pos.text}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 3, fontSize: 11 }}>
            <span
              style={{
                padding: "1px 6px",
                borderRadius: 4,
                background:
                  pos.post_type === "link" ? C.blueLight : C.grayLight,
                color: pos.post_type === "link" ? C.blue : C.gray,
                fontWeight: 600,
              }}
            >
              {pos.post_type === "link" ? "Link" : "Claim"}
            </span>
            {pos.topic && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  window.dispatchEvent(new CustomEvent("verisphere:navigate", { detail: { topic: pos.topic } }));
                }}
                style={{ fontSize: 10, color: "#2563eb", cursor: "pointer", textDecoration: "underline" }}
                title={"View in article: " + pos.topic}
              >
                {pos.topic.length > 20 ? pos.topic.slice(0, 17) + "…" : pos.topic}
              </span>
            )}
            { (
              <span
                style={{ color: vsColor(pos.verity_score), fontWeight: 600 }}
              >
                VS {pos.verity_score > 0 ? "+" : ""}
                {pos.verity_score.toFixed(1)}%
              </span>
            )}
            {!pos.is_active && (
              <span style={{ color: C.amber, fontWeight: 600 }}>Inactive</span>
            )}
          </div>
        </div>

        {/* Stake amounts + APR */}
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>
            {fmt(pos.user_total)} VSP
          </div>
          <div style={{ fontSize: 11, color: sColor, fontWeight: 600 }}>
            {pos.position_status.charAt(0).toUpperCase() +
              pos.position_status.slice(1)}
          </div>
          {
            pos.estimated_apr !== undefined &&
            pos.estimated_apr !== 0 && (
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  marginTop: 1,
                  color: pos.estimated_apr > 0 ? C.green : C.red,
                }}
              >
                {pos.estimated_apr > 0 ? "+" : ""}
                {pos.estimated_apr.toFixed(1)}% APR
              </div>
            )}
          {pos.apr_breakdown && expanded && (
            <div style={{ fontSize: 9, color: C.textMuted, marginTop: 2, lineHeight: 1.6, textAlign: "right" }}>
              <div>Truth Pressure: {pos.apr_breakdown.abs_vs.toFixed(1)}%</div>
              <div>Post Size: {pos.apr_breakdown.total_stake.toFixed(1)} / {pos.apr_breakdown.s_max.toFixed(1)}</div>
              <div>Queue Position: {(pos.apr_breakdown.tranche ?? 0) + 1} of {pos.apr_breakdown.num_tranches ?? 10} ({((pos.apr_breakdown.position_weight ?? 1) * 100).toFixed(0)}%)</div>
              <div>Rate: {pos.apr_breakdown.r_eff.toFixed(1)}% ({pos.apr_breakdown.vs === 0 ? "neutral" : pos.apr_breakdown.is_winner ? "earning" : "losing"})</div>
            </div>
          )}
        </div>

        {/* Expand chevron */}
        <span
          style={{
            fontSize: 14,
            color: C.textMuted,
            flexShrink: 0,
            transition: "transform 0.2s",
            transform: expanded ? "rotate(90deg)" : "none",
          }}
        >
          ›
        </span>
      </div>

      {/* Expanded detail — compact */}
      {expanded && pos.superseded_by && (
        <SupersedePanel
          supersedeInfo={pos.superseded_by}
          userSupport={pos.user_support}
          userChallenge={pos.user_challenge}
          address={address || ""}
          onDone={fetchPortfolio}
        />
      )}
      {expanded && (
        <div
          style={{
            borderTop: `1px solid ${C.grayBorder}`,
            padding: "10px 16px 12px",
            background: "#fafafa",
          }}
        >
          <div style={{ marginLeft: 44, paddingLeft: 12, borderLeft: "2px solid " + C.grayBorder }}>
          {/* Compact: YOUR POSITION | QUEUE TOTALS — single row with thumb icons */}
          <div
            style={{
              display: "flex",
              gap: 16,
              alignItems: "flex-start",
              flexWrap: "wrap",
              marginBottom: 8,
            }}
          >
            {/* Your Position */}
            <div style={{ flex: "1 1 140px" }}>
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: C.gray,
                  textTransform: "uppercase",
                  letterSpacing: ".04em",
                  marginBottom: 4,
                }}
              >
                Your Position
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span
                  title="Your support stake"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 3,
                    padding: "2px 8px",
                    borderRadius: 12,
                    background: C.greenLight,
                    fontSize: 12,
                    fontWeight: 600,
                    color: C.green,
                  }}
                >
                  👍 {fmt(pos.user_support)}
                </span>
                <span
                  title="Your challenge stake"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 3,
                    padding: "2px 8px",
                    borderRadius: 12,
                    background: C.redLight,
                    fontSize: 12,
                    fontWeight: 600,
                    color: C.red,
                  }}
                >
                  👎 {fmt(pos.user_challenge)}
                </span>
              </div>
            </div>
            {/* Queue Totals */}
            <div style={{ flex: "1 1 140px" }}>
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: C.gray,
                  textTransform: "uppercase",
                  letterSpacing: ".04em",
                  marginBottom: 4,
                }}
              >
                Queue Totals
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span
                  title="Total support in queue"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 3,
                    padding: "2px 8px",
                    borderRadius: 12,
                    background: C.greenLight,
                    fontSize: 12,
                    fontWeight: 600,
                    color: C.green,
                  }}
                >
                  👍 {fmt(pos.pool_support)}
                </span>
                <span
                  title="Total challenge in queue"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 3,
                    padding: "2px 8px",
                    borderRadius: 12,
                    background: C.redLight,
                    fontSize: 12,
                    fontWeight: 600,
                    color: C.red,
                  }}
                >
                  👎 {fmt(pos.pool_challenge)}
                </span>
              </div>
            </div>
          </div>

          {/* Distribution bar */}
          {pos.pool_total > 0 && (
            <div style={{ marginBottom: 6 }}>
              <div
                style={{
                  height: 3,
                  borderRadius: 2,
                  background: "rgba(220, 38, 38, 0.10)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${(pos.pool_support / pos.pool_total) * 100}%`,
                    background: C.green,
                    borderRadius: 3,
                  }}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 9,
                  color: C.textMuted,
                  marginTop: 1,
                }}
              >
                <span>
                  {((pos.pool_support / pos.pool_total) * 100).toFixed(0)}%
                  support
                </span>
                <span>
                  Your share:{" "}
                  <strong style={{ color: C.text }}>
                    {((pos.user_total / pos.pool_total) * 100).toFixed(0)}%
                  </strong>
                </span>
                <span>
                  {((pos.pool_challenge / pos.pool_total) * 100).toFixed(0)}%
                  challenge
                </span>
              </div>
            </div>
          )}

          {/* Claim/link actions: stake, unstake, link */}
          <InlineClaimCard
            postId={pos.post_id}
            text={pos.text}
            stakeSupport={pos.pool_support}
            stakeChallenge={pos.pool_challenge}
            verityScore={pos.verity_score}
            postType={pos.post_type === "link" ? "link" : "claim"}
            onRefresh={onRefresh}
          />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Filter Tabs ────────────────────────────────────────────

type Filter = "all" | "winning" | "losing" | "claims" | "links";

function FilterTabs({
  active,
  counts,
  onChange,
}: {
  active: Filter;
  counts: Record<Filter, number>;
  onChange: (f: Filter) => void;
}) {
  const tabs: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "winning", label: "Winning" },
    { key: "losing", label: "Losing" },
    { key: "claims", label: "Claims" },
    { key: "links", label: "Links" },
  ];

  return (
    <div
      style={{
        display: "flex",
        gap: 4,
        marginBottom: 12,
        flexWrap: "wrap",
      }}
    >
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          style={{
            padding: "5px 12px",
            borderRadius: 20,
            fontSize: 12,
            fontWeight: 600,
            border:
              active === t.key
                ? `1px solid ${C.text}`
                : `1px solid ${C.grayBorder}`,
            background: active === t.key ? C.text : C.white,
            color: active === t.key ? C.white : C.gray,
            cursor: "pointer",
          }}
        >
          {t.label} ({counts[t.key]})
        </button>
      ))}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────


// ── Supersede Notification Panel ──────────────────────────
function SupersedePanel({
  supersedeInfo,
  userSupport,
  userChallenge,
  address,
  onDone,
}: {
  supersedeInfo: { supersede_id: number; new_post_id: number; new_text: string; created_by: string };
  userSupport: number;
  userChallenge: number;
  address: string;
  onDone: () => void;
}) {
  const [acting, setActing] = useState(false);
  const { stake, withdraw } = useStake();

  const respond = async (response: "accept" | "reject") => {
    setActing(true);
    try {
      if (response === "accept") {
        // Move stake: withdraw from old, stake on new (same side, same amount)
        const oldPostId = supersedeInfo.supersede_id; // We need the old_post_id, not supersede_id
        // Actually we need to get old_post_id from the position itself
        // The withdraw/stake will be done by the caller passing the right post_ids
      }
      await fetch(`${API_BASE}/supersedes/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supersede_id: supersedeInfo.supersede_id,
          user_address: address,
          response,
        }),
      });
      onDone();
    } catch (e) {
      console.error("Supersede response failed:", e);
    } finally {
      setActing(false);
    }
  };

  return (
    <div
      style={{
        margin: "8px 16px",
        padding: "10px 12px",
        background: "#fffbeb",
        border: "1px solid #fcd34d",
        borderRadius: 8,
        fontSize: 12,
      }}
    >
      <div style={{ fontWeight: 700, color: "#92400e", marginBottom: 4 }}>
        📝 An updated version of this claim exists
      </div>
      <div style={{ color: "#78350f", marginBottom: 6, lineHeight: 1.5 }}>
        <span style={{ fontWeight: 600 }}>New version:</span> {supersedeInfo.new_text}
      </div>
      <div style={{ color: "#92400e", marginBottom: 8, fontSize: 11 }}>
        Your stake: {userSupport > 0 ? `${userSupport.toFixed(2)} VSP support` : `${userChallenge.toFixed(2)} VSP challenge`}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => respond("accept")}
          disabled={acting}
          style={{
            padding: "5px 14px",
            borderRadius: 6,
            border: "none",
            background: "#059669",
            color: "#fff",
            fontSize: 12,
            fontWeight: 600,
            cursor: acting ? "default" : "pointer",
            opacity: acting ? 0.6 : 1,
          }}
        >
          {acting ? "Moving…" : "Move stake to new version"}
        </button>
        <button
          onClick={() => respond("reject")}
          disabled={acting}
          style={{
            padding: "5px 14px",
            borderRadius: 6,
            border: "1px solid #d1d5db",
            background: "#fff",
            color: "#6b7280",
            fontSize: 12,
            cursor: acting ? "default" : "pointer",
            opacity: acting ? 0.6 : 1,
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

export default function Portfolio({ onBack }: { onBack?: () => void }) {
  const { address, isConnected } = useAccount();
  const [data, setData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [hideDust, setHideDust] = useState(true);

  const fetchPortfolio = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/portfolio/fast/${address}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e: any) {
      setError(e.message || "Failed to load portfolio");
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    if (isConnected && address) fetchPortfolio();
  }, [isConnected, address, fetchPortfolio]);

  if (!isConnected) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "60px 20px",
          color: C.textMuted,
          fontSize: 15,
        }}
      >
        Connect your wallet to view your portfolio.
      </div>
    );
  }

  if (loading) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "60px 20px",
          color: C.textMuted,
          fontSize: 14,
        }}
      >
        Loading positions…
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "40px 20px",
        }}
      >
        <div style={{ color: C.red, marginBottom: 10 }}>{error}</div>
        <button
          className="btn btn-primary"
          onClick={fetchPortfolio}
          style={{ fontSize: 13 }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { summary, positions } = data;

  // Compute filter counts
  const counts: Record<Filter, number> = {
    all: positions.length,
    winning: positions.filter((p) => p.position_status === "winning").length,
    losing: positions.filter((p) => p.position_status === "losing").length,
    claims: positions.filter((p) => p.post_type === "claim").length,
    links: positions.filter((p) => p.post_type === "link").length,
  };

  // Apply filter
  const filtered = positions.filter((p) => {
    if (filter === "all") return true;
    if (filter === "winning") return p.position_status === "winning";
    if (filter === "losing") return p.position_status === "losing";
    if (filter === "claims") return p.post_type === "claim";
    if (filter === "links") return p.post_type === "link";
    return true;
  });

  // Also filter from counts
  const dustCount = positions.filter((p) => p.user_total < 0.01).length;

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", display: "flex", flexDirection: "column" as const, flex: 1, minHeight: 0, overflow: "hidden" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 16,
        }}
      >
        {onBack && (
          <button
            onClick={onBack}
            style={{
              background: "none",
              border: "none",
              fontSize: 18,
              color: C.gray,
              cursor: "pointer",
              padding: "4px 8px",
            }}
          >
            ←
          </button>
        )}
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 700,
              color: C.text,
            }}
          >
            Portfolio
          </h2>
          <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>
            {address?.slice(0, 6)}…{address?.slice(-4)}
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={fetchPortfolio}
            style={{
              background: "none",
              border: `1px solid ${C.grayBorder}`,
              borderRadius: 6,
              padding: "5px 12px",
              fontSize: 11,
              fontWeight: 600,
              color: C.gray,
              cursor: "pointer",
            }}
          >
            ↻ Refresh
          </button>
          {isConnected && <PlusButton onDone={fetchPortfolio} />}
        </div>
      </div>

      {/* Summary cards */}
      <div
        style={{
          display: "flex",
          gap: 10,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        <StatCard
          label="Total Staked"
          value={`${fmt(summary.total_staked)} VSP`}
          sub={`${summary.winning_count + summary.losing_count + summary.neutral_count} positions`}
        />
        <StatCard
          label="Winning"
          value={String(summary.winning_count)}
          color={summary.winning_count > 0 ? C.green : C.gray}
          sub={`${fmt(summary.total_support)} support`}
        />
        <StatCard
          label="Losing"
          value={String(summary.losing_count)}
          color={summary.losing_count > 0 ? C.red : C.gray}
          sub={`${fmt(summary.total_challenge)} challenge`}
        />
        <StatCard
          label="Overall APR"
          value={`${summary.weighted_apr > 0 ? "+" : ""}${(summary.weighted_apr ?? 0).toFixed(1)}%`}
          color={summary.weighted_apr > 0 ? C.green : summary.weighted_apr < 0 ? C.red : C.gray}
          sub="weighted average"
        />
      </div>

      {/* Win/loss ratio bar */}
      {data.position_count > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div
            style={{
              height: 8,
              borderRadius: 4,
              background: C.grayLight,
              overflow: "hidden",
              display: "flex",
            }}
          >
            {summary.winning_count > 0 && (
              <div
                style={{
                  height: "100%",
                  width: `${(summary.winning_count / data.position_count) * 100}%`,
                  background: C.green,
                }}
              />
            )}
            {summary.neutral_count > 0 && (
              <div
                style={{
                  height: "100%",
                  width: `${(summary.neutral_count / data.position_count) * 100}%`,
                  background: C.grayBorder,
                }}
              />
            )}
            {summary.losing_count > 0 && (
              <div
                style={{
                  height: "100%",
                  width: `${(summary.losing_count / data.position_count) * 100}%`,
                  background: C.red,
                }}
              />
            )}
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 10,
              color: C.textMuted,
              marginTop: 3,
            }}
          >
            <span>
              {((summary.winning_count / data.position_count) * 100).toFixed(0)}
              % winning
            </span>
            <span>
              {((summary.losing_count / data.position_count) * 100).toFixed(0)}%
              losing
            </span>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <FilterTabs active={filter} counts={counts} onChange={setFilter} />

      {/* Positions list — scrollable */}
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0, paddingRight: 4 }}>
      {filtered.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "40px 20px",
            color: C.textMuted,
            fontSize: 13,
            background: C.white,
            borderRadius: 10,
            border: `1px solid ${C.grayBorder}`,
          }}
        >
          {data.position_count === 0
            ? "No staking positions yet. Explore topics and stake on claims to get started."
            : "No positions match this filter."}
        </div>
      ) : (
        filtered.map((pos) => <PositionRow key={pos.post_id} pos={pos} onRefresh={() => { window.dispatchEvent(new Event("verisphere:data-changed")); setTimeout(fetchPortfolio, 2000); }} />)
      )}
      </div>
    </div>
  );
}
