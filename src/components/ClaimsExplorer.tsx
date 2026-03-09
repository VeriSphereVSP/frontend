// frontend/src/components/ClaimsExplorer.tsx
import { useState, useEffect, useMemo, useCallback } from "react";

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

const COLS: {
  key: SortKey;
  label: string;
  w?: string;
  align?: string;
  fmt?: (v: any) => string;
}[] = [
  { key: "post_id", label: "#", w: "48px" },
  { key: "text", label: "Claim", w: "minmax(200px, 1fr)" },
  {
    key: "verity_score",
    label: "VS",
    w: "64px",
    fmt: (v) => `${v > 0 ? "+" : ""}${v.toFixed(1)}%`,
  },
  {
    key: "total_stake",
    label: "Stake",
    w: "72px",
    fmt: (v) => `${v.toFixed(2)}`,
  },
  {
    key: "controversy",
    label: "Controversy",
    w: "86px",
    fmt: (v) => v.toFixed(2),
  },
  {
    key: "stake_support",
    label: "Support",
    w: "72px",
    fmt: (v) => v.toFixed(2),
  },
  {
    key: "stake_challenge",
    label: "Challenge",
    w: "72px",
    fmt: (v) => v.toFixed(2),
  },
  { key: "incoming_links", label: "In", w: "40px" },
  { key: "outgoing_links", label: "Out", w: "40px" },
  { key: "topic", label: "Topic", w: "100px" },
];

function vsColor(vs: number): string {
  if (vs > 50) return "#059669";
  if (vs > 0) return "#10b981";
  if (vs === 0) return "#6b7280";
  if (vs > -50) return "#ef4444";
  return "#dc2626";
}

export default function ClaimsExplorer() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("total_stake");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filter, setFilter] = useState("");
  const [topicFilter, setTopicFilter] = useState("");

  const fetchClaims = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/claims/all?limit=500`);
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

  const topics = useMemo(() => {
    const set = new Set(claims.map((c) => c.topic).filter(Boolean));
    return Array.from(set).sort();
  }, [claims]);

  const filtered = useMemo(() => {
    let list = claims;
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
  }, [claims, filter, topicFilter]);

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
  const totalStake = claims.reduce((s, c) => s + c.total_stake, 0);
  const avgVS =
    claims.length > 0
      ? claims.reduce((s, c) => s + c.verity_score, 0) / claims.length
      : 0;
  const mostControversial =
    claims.length > 0
      ? claims.reduce((a, b) => (a.controversy > b.controversy ? a : b))
      : null;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 16px" }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
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

      {/* Stats bar */}
      <div
        style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}
      >
        {[
          { label: "Claims", value: claims.length },
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
              {t}
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
            overflowX: "auto",
            border: "1px solid #e5e7eb",
            borderRadius: 8,
          }}
        >
          <table
            style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}
          >
            <thead>
              <tr
                style={{
                  background: "#f8fafc",
                  borderBottom: "2px solid #e5e7eb",
                }}
              >
                {COLS.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => toggleSort(col.key)}
                    style={{
                      padding: "8px 8px",
                      textAlign: col.key === "text" ? "left" : "right",
                      cursor: "pointer",
                      userSelect: "none",
                      whiteSpace: "nowrap",
                      fontWeight: 600,
                      color: sortKey === col.key ? "#2563eb" : "#6b7280",
                      fontSize: 11,
                    }}
                  >
                    {col.label}
                    {sortKey === col.key && (
                      <span style={{ marginLeft: 2, fontSize: 10 }}>
                        {sortDir === "asc" ? "▲" : "▼"}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((c, i) => (
                <tr
                  key={c.post_id}
                  style={{
                    borderBottom: "1px solid #f0f0f0",
                    background: i % 2 === 0 ? "#fff" : "#fafbfc",
                    cursor: "default",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "#f0f4ff")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background =
                      i % 2 === 0 ? "#fff" : "#fafbfc")
                  }
                >
                  {COLS.map((col) => {
                    const raw = c[col.key];
                    let display: string | JSX.Element;

                    if (col.key === "text") {
                      const t = String(raw);
                      display = t.length > 60 ? t.slice(0, 57) + "…" : t;
                    } else if (col.key === "verity_score") {
                      const v = raw as number;
                      display = (
                        <span style={{ color: vsColor(v), fontWeight: 600 }}>
                          {v > 0 ? "+" : ""}
                          {v.toFixed(1)}%
                        </span>
                      );
                    } else if (col.fmt) {
                      display = col.fmt(raw);
                    } else {
                      display = String(raw ?? "");
                    }

                    return (
                      <td
                        key={col.key}
                        style={{
                          padding: "6px 8px",
                          textAlign: col.key === "text" ? "left" : "right",
                          maxWidth: col.key === "text" ? 320 : undefined,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          color: col.key === "post_id" ? "#9ca3af" : "#374151",
                        }}
                        title={col.key === "text" ? String(raw) : undefined}
                      >
                        {display}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
