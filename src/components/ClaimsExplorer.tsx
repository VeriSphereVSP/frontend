import { useAccount } from "wagmi";
// frontend/src/components/ClaimsExplorer.tsx
import { useState, useEffect, useMemo, useCallback } from "react";
import Jazzicon from "./Jazzicon";
import { InlineClaimCard } from "./ArticleView";
import { PlusButton } from "./article";

const API = import.meta.env.VITE_API_BASE || "/api";

type Claim = {
  post_id: number;
  text: string;
  verity_score: number;
  base_vs: number;
  stake_support: number;
  stake_challenge: number;
  total_stake: number;
  controversy: number;
  incoming_links: number;
  outgoing_links: number;
  topic: string;
  created_at: string | null;
};

type SortKey = keyof Claim;
type SortDir = "asc" | "desc";

const COLS: { key: SortKey; label: string }[] = [
  { key: "post_id", label: "#" },
  { key: "text", label: "Claim" },
  { key: "verity_score", label: "VS" },
  { key: "total_stake", label: "Stake" },
  { key: "controversy", label: "Controversy" },
  { key: "stake_support", label: "Support" },
  { key: "stake_challenge", label: "Challenge" },
  { key: "incoming_links", label: "In" },
  { key: "outgoing_links", label: "Out" },
  { key: "topic", label: "Topic" },
];

function vsColor(vs: number): string {
  if (vs > 50) return "#059669";
  if (vs > 0) return "#10b981";
  if (vs === 0) return "#6b7280";
  if (vs > -50) return "#ef4444";
  return "#dc2626";
}

export default function ClaimsExplorer() {
  const { isConnected } = useAccount();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("total_stake");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filter, setFilter] = useState("");
  const [topicFilter, setTopicFilter] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchClaims = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/claims/fast/all?limit=500`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setClaims(data.claims || []);
    } catch (e: any) {
      setError(e.message || "Failed to load claims");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClaims();
  }, [fetchClaims]);

  // Deduplicate by post_id (a claim can appear in multiple articles)
  const dedupClaims = useMemo(() => {
    const seen = new Map<number, Claim>();
    for (const c of claims) {
      if (!seen.has(c.post_id)) {
        seen.set(c.post_id, c);
      } else {
        // Keep the one with the shorter (more natural) topic name
        const existing = seen.get(c.post_id)!;
        if (
          c.topic &&
          (!existing.topic || c.topic.length < existing.topic.length)
        ) {
          seen.set(c.post_id, c);
        }
      }
    }
    return Array.from(seen.values());
  }, [claims]);

  const topics = useMemo(() => {
    const set = new Set(dedupClaims.map((c) => c.topic).filter(Boolean));
    return Array.from(set).sort();
  }, [dedupClaims]);

  const filtered = useMemo(() => {
    let list = dedupClaims;
    if (filter.trim()) {
      const q = filter.toLowerCase();
      list = list.filter(
        (c) =>
          c.text.toLowerCase().includes(q) || String(c.post_id).includes(q),
      );
    }
    if (topicFilter) {
      list = list.filter((c) => c.topic === topicFilter);
    }
    return list;
  }, [dedupClaims, filter, topicFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp =
        typeof av === "string"
          ? av.localeCompare(bv as string)
          : (av as number) - (bv as number);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "text" || key === "topic" ? "asc" : "desc");
    }
  };

  // Stats
  const totalStake = dedupClaims.reduce((s, c) => s + c.total_stake, 0);
  const avgVS =
    dedupClaims.length > 0
      ? dedupClaims.reduce((s, c) => s + c.verity_score, 0) / dedupClaims.length
      : 0;
  const mostControversial =
    dedupClaims.length > 0
      ? dedupClaims.reduce((a, b) => (a.controversy > b.controversy ? a : b))
      : null;

  const fmtVS = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px", display: "flex", flexDirection: "column" as const, height: "100%", minHeight: 0 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: "#1a1a2e",
                margin: "0 0 4px",
              }}
            >
              Claims Explorer
            </h1>
            <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>
              All on-chain claims with live metrics from the protocol.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              onClick={fetchClaims}
              style={{
                background: "none",
                border: "1px solid #e5e7eb",
                borderRadius: 6,
                padding: "5px 12px",
                fontSize: 12,
                color: "#6b7280",
                cursor: "pointer",
              }}
            >
              ↻ Refresh
            </button>
            {isConnected && <PlusButton onDone={fetchClaims} />}
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div
        style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}
      >
        {[
          { label: "Claims", value: String(dedupClaims.length) },
          { label: "Total Staked", value: `${totalStake.toFixed(1)} VSP` },
          {
            label: "Avg VS",
            value: `${avgVS >= 0 ? "+" : ""}${avgVS.toFixed(1)}%`,
          },
          {
            label: "Most Controversial",
            value: mostControversial ? `#${mostControversial.post_id}` : "—",
          },
        ].map((s, i) => (
          <div
            key={i}
            style={{
              padding: "8px 14px",
              background: "#f8fafc",
              borderRadius: 6,
              border: "1px solid #e5e7eb",
              minWidth: 100,
            }}
          >
            <div
              style={{
                fontSize: 10,
                color: "#9ca3af",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: ".04em",
              }}
            >
              {s.label}
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#1a1a2e" }}>
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div
        style={{
          display: "flex",
          gap: 10,
          marginBottom: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search claims…"
          style={{
            padding: "6px 10px",
            borderRadius: 5,
            border: "1px solid #d1d5db",
            fontSize: 13,
            width: 240,
          }}
        />
        <select
          value={topicFilter}
          onChange={(e) => setTopicFilter(e.target.value)}
          style={{
            padding: "6px 10px",
            borderRadius: 5,
            border: "1px solid #d1d5db",
            fontSize: 13,
            background: "#fff",
          }}
        >
          <option value="">All topics</option>
          {topics.map((t) => (
            <option key={t} value={t}>
              {t.length > 40 ? t.slice(0, 37) + "…" : t}
            </option>
          ))}
        </select>
        <button
          onClick={fetchClaims}
          style={{
            padding: "6px 14px",
            borderRadius: 5,
            border: "1px solid #d1d5db",
            fontSize: 13,
            cursor: "pointer",
            background: "#fff",
          }}
        >
          ↻ Refresh
        </button>
        <span style={{ fontSize: 12, color: "#9ca3af" }}>
          {sorted.length} claim{sorted.length !== 1 ? "s" : ""}
          {filter || topicFilter ? " (filtered)" : ""}
        </span>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
          Loading claims…
        </div>
      ) : error ? (
        <div style={{ padding: 40, textAlign: "center", color: "#ef4444" }}>
          {error}
        </div>
      ) : sorted.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>
          No claims found.
        </div>
      ) : (
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 8,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column" as any,
            flex: 1,
            minHeight: 0,
          }}
        >
          {/* Header row — fixed */}
          <div
            style={{
              display: "flex",
              background: "#f8fafc",
              borderBottom: "2px solid #e5e7eb",
              padding: "0 12px",
            }}
          >
            {COLS.map((col) => (
              <div
                key={col.key}
                onClick={() => toggleSort(col.key)}
                style={{
                  padding: "8px 6px",
                  cursor: "pointer",
                  userSelect: "none",
                  whiteSpace: "nowrap",
                  fontWeight: 600,
                  fontSize: 11,
                  color: sortKey === col.key ? "#2563eb" : "#6b7280",
                  flex:
                    col.key === "text"
                      ? "3 1 0"
                      : col.key === "topic"
                        ? "1.5 1 0"
                        : "0 0 60px",
                  textAlign:
                    col.key === "text" || col.key === "topic"
                      ? "left"
                      : "right",
                }}
              >
                {col.label}
                {sortKey === col.key && (
                  <span style={{ marginLeft: 2, fontSize: 10 }}>
                    {sortDir === "asc" ? "▲" : "▼"}
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Data rows — scrollable */}
          <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
          {sorted.map((c, i) => {
            const isExpanded = expandedId === c.post_id;
            return (
              <div key={c.post_id}>
                {/* Claim row */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : c.post_id)}
                  style={{
                    display: "flex",
                    padding: "0 12px",
                    cursor: "pointer",
                    borderBottom: isExpanded ? "none" : "1px solid #f0f0f0",
                    background: isExpanded
                      ? "#f0f4ff"
                      : i % 2 === 0
                        ? "#fff"
                        : "#fafbfc",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => {
                    if (!isExpanded)
                      e.currentTarget.style.background = "#f0f4ff";
                  }}
                  onMouseLeave={(e) => {
                    if (!isExpanded)
                      e.currentTarget.style.background =
                        i % 2 === 0 ? "#fff" : "#fafbfc";
                  }}
                >
                  {/* # */}
                  <div
                    style={{
                      flex: "0 0 60px",
                      padding: "6px",
                      fontSize: 12,
                      color: "#9ca3af",
                      textAlign: "right",
                    }}
                  >
                    {c.post_id}
                  </div>
                  {/* Claim text */}
                  <div
                    style={{
                      flex: "3 1 0",
                      padding: "6px",
                      fontSize: 12,
                      color: "#374151",
                      overflow: isExpanded ? "visible" : "hidden",
                      textOverflow: isExpanded ? "unset" : "ellipsis",
                      whiteSpace: isExpanded ? "normal" : "nowrap",
                    }}
                    title={c.text}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                      {c.creator && <Jazzicon address={c.creator} size={14} />}
                      {isExpanded ? c.text : (c.text.length > 60 ? c.text.slice(0, 57) + "…" : c.text)}
                    </span>
                  </div>
                  {/* VS */}
                  <div
                    style={{
                      flex: "0 0 60px",
                      padding: "6px",
                      fontSize: 12,
                      textAlign: "right",
                    }}
                  >
                    <span
                      style={{
                        color: vsColor(c.verity_score),
                        fontWeight: 600,
                      }}
                    >
                      {fmtVS(c.verity_score)}
                    </span>
                  </div>
                  {/* Stake */}
                  <div
                    style={{
                      flex: "0 0 60px",
                      padding: "6px",
                      fontSize: 12,
                      textAlign: "right",
                      color: "#374151",
                    }}
                  >
                    {c.total_stake.toFixed(2)}
                  </div>
                  {/* Controversy */}
                  <div
                    style={{
                      flex: "0 0 60px",
                      padding: "6px",
                      fontSize: 12,
                      textAlign: "right",
                      color: "#374151",
                    }}
                  >
                    {c.controversy.toFixed(2)}
                  </div>
                  {/* Support */}
                  <div
                    style={{
                      flex: "0 0 60px",
                      padding: "6px",
                      fontSize: 12,
                      textAlign: "right",
                      color: "#374151",
                    }}
                  >
                    {c.stake_support.toFixed(2)}
                  </div>
                  {/* Challenge */}
                  <div
                    style={{
                      flex: "0 0 60px",
                      padding: "6px",
                      fontSize: 12,
                      textAlign: "right",
                      color: "#374151",
                    }}
                  >
                    {c.stake_challenge.toFixed(2)}
                  </div>
                  {/* In */}
                  <div
                    style={{
                      flex: "0 0 60px",
                      padding: "6px",
                      fontSize: 12,
                      textAlign: "right",
                      color: "#374151",
                    }}
                  >
                    {c.incoming_links}
                  </div>
                  {/* Out */}
                  <div
                    style={{
                      flex: "0 0 60px",
                      padding: "6px",
                      fontSize: 12,
                      textAlign: "right",
                      color: "#374151",
                    }}
                  >
                    {c.outgoing_links}
                  </div>
                  {/* Topic */}
                  <div
                    style={{
                      flex: "1.5 1 0",
                      padding: "6px",
                      fontSize: 11,
                      color: "#6b7280",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {c.topic ? (
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          // Navigate to the topic article
                          window.dispatchEvent(
                            new CustomEvent("verisphere:navigate", {
                              detail: { topic: c.topic },
                            }),
                          );
                        }}
                        style={{
                          color: "#2563eb",
                          textDecoration: "none",
                          fontSize: 11,
                        }}
                        title={`Open article: ${c.topic}`}
                      >
                        {c.topic.length > 25
                          ? c.topic.slice(0, 22) + "…"
                          : c.topic}
                      </a>
                    ) : (
                      "—"
                    )}
                  </div>
                </div>

                {/* Expanded claim card */}
                {isExpanded && (
                  <div
                    style={{
                      padding: "0 12px 12px",
                      background: "#f0f4ff",
                      borderBottom: "1px solid #e5e7eb",
                    }}
                  >
                    <div style={{ marginLeft: 44, borderLeft: "2px solid #e5e7eb", paddingLeft: 12 }}>
                    <InlineClaimCard
                      postId={c.post_id}
                      text={c.text}
                      stakeSupport={c.stake_support}
                      stakeChallenge={c.stake_challenge}
                      verityScore={c.verity_score}
                      onRefresh={fetchClaims}
                      onClose={() => setExpandedId(null)}
                    />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          </div>
        </div>
      )}
    </div>
  );
}
