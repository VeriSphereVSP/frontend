// frontend/src/components/article/ClaimPickerModal.tsx
// Modal that lets users browse all on-chain claims with filtering/sorting
// to select a link target. Reuses Claims Explorer patterns.

import { useState, useEffect, useMemo, useCallback } from "react";
import { C, n, fmt, vc } from "./theme";

const API = import.meta.env.VITE_API_BASE || "/api";

type PickerClaim = {
  post_id: number;
  text: string;
  verity_score: number;
  stake_support: number;
  stake_challenge: number;
  total_stake: number;
  controversy: number;
  incoming_links: number;
  outgoing_links: number;
  topic: string | null;
};

type SortKey =
  | "text"
  | "verity_score"
  | "total_stake"
  | "controversy"
  | "topic";
type SortDir = "asc" | "desc";

export default function ClaimPickerModal({
  onPick,
  onClose,
  excludePostId,
}: {
  onPick: (claim: PickerClaim) => void;
  onClose: () => void;
  excludePostId?: number | null;
}) {
  const [claims, setClaims] = useState<PickerClaim[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [topicFilter, setTopicFilter] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("total_stake");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selected, setSelected] = useState<number | null>(null);

  const fetchClaims = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/claims/search?limit=500`);
      if (res.ok) {
        const data = await res.json();
        setClaims(data.claims || []);
      }
    } catch (e) {
      // fallback to fast endpoint
      try {
        const res = await fetch(`${API}/claims/fast/all?limit=500&include_links=false`);
        if (res.ok) {
          const data = await res.json();
          setClaims(data.claims || []);
        }
      } catch {}
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClaims();
  }, [fetchClaims]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const topics = useMemo(() => {
    const set = new Set(claims.map((c) => c.topic).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [claims]);

  const filtered = useMemo(() => {
    let list = claims;
    // Exclude the current claim
    if (excludePostId != null) {
      list = list.filter((c) => c.post_id !== excludePostId);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.text.toLowerCase().includes(q) || String(c.post_id).includes(q),
      );
    }
    if (topicFilter) {
      list = list.filter((c) => c.topic === topicFilter);
    }
    return list;
  }, [claims, search, topicFilter, excludePostId]);

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

  const selectedClaim = claims.find((c) => c.post_id === selected);

  const colStyle = (key: SortKey, flex?: string): React.CSSProperties => ({
    padding: "5px 4px",
    cursor: "pointer",
    userSelect: "none",
    whiteSpace: "nowrap",
    fontWeight: 600,
    fontSize: 10,
    color: sortKey === key ? "#2563eb" : "#6b7280",
    flex: flex || "0 0 55px",
    textAlign: key === "text" || key === "topic" ? "left" : "right",
  });

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 10,
          width: "min(90vw, 720px)",
          maxHeight: "80vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 8px 30px rgba(0,0,0,0.18)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "12px 16px 8px",
            borderBottom: `1px solid ${C.gb}`,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: 15,
                fontWeight: 700,
                color: C.text,
              }}
            >
              Select a Claim to Link
            </h3>
            <span
              onClick={onClose}
              style={{
                cursor: "pointer",
                fontSize: 18,
                color: C.muted,
                padding: "0 4px",
              }}
            >
              ✕
            </span>
          </div>

          {/* Filters */}
          <div
            style={{
              display: "flex",
              gap: 6,
              marginTop: 8,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search claims…"
              autoFocus
              style={{
                padding: "4px 8px",
                borderRadius: 4,
                border: `1px solid ${C.gb}`,
                fontSize: 12,
                flex: "1 1 180px",
                minWidth: 120,
              }}
            />
            <select
              value={topicFilter}
              onChange={(e) => setTopicFilter(e.target.value)}
              style={{
                padding: "4px 8px",
                borderRadius: 4,
                border: `1px solid ${C.gb}`,
                fontSize: 12,
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
            <span style={{ fontSize: 11, color: C.muted }}>
              {sorted.length} claim{sorted.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Table */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {loading ? (
            <div
              style={{
                padding: 30,
                textAlign: "center",
                color: C.muted,
                fontSize: 12,
              }}
            >
              Loading claims…
            </div>
          ) : sorted.length === 0 ? (
            <div
              style={{
                padding: 30,
                textAlign: "center",
                color: C.muted,
                fontSize: 12,
              }}
            >
              No claims found.
            </div>
          ) : (
            <>
              {/* Column headers */}
              <div
                style={{
                  display: "flex",
                  background: "#f8fafc",
                  borderBottom: "1px solid #e5e7eb",
                  padding: "0 8px",
                  position: "sticky",
                  top: 0,
                  zIndex: 2,
                }}
              >
                <div
                  style={{ ...colStyle("text", "3 1 0"), textAlign: "left" }}
                  onClick={() => toggleSort("text")}
                >
                  Claim {sortKey === "text" && (sortDir === "asc" ? "▲" : "▼")}
                </div>
                <div
                  style={colStyle("verity_score")}
                  onClick={() => toggleSort("verity_score")}
                >
                  VS{" "}
                  {sortKey === "verity_score" &&
                    (sortDir === "asc" ? "▲" : "▼")}
                </div>
                <div
                  style={colStyle("total_stake")}
                  onClick={() => toggleSort("total_stake")}
                >
                  Stake{" "}
                  {sortKey === "total_stake" && (sortDir === "asc" ? "▲" : "▼")}
                </div>
                <div
                  style={colStyle("controversy")}
                  onClick={() => toggleSort("controversy")}
                >
                  Contr.{" "}
                  {sortKey === "controversy" && (sortDir === "asc" ? "▲" : "▼")}
                </div>
                <div
                  style={{ ...colStyle("topic", "1 1 0"), textAlign: "left" }}
                  onClick={() => toggleSort("topic")}
                >
                  Topic {sortKey === "topic" && (sortDir === "asc" ? "▲" : "▼")}
                </div>
              </div>

              {/* Rows */}
              {sorted.map((c) => {
                const isSel = selected === c.post_id;
                return (
                  <div
                    key={c.post_id}
                    onClick={() => setSelected(isSel ? null : c.post_id)}
                    style={{
                      display: "flex",
                      padding: "4px 8px",
                      cursor: "pointer",
                      borderBottom: "1px solid #f0f0f0",
                      background: isSel ? "#dbeafe" : "transparent",
                      transition: "background 0.1s",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSel) e.currentTarget.style.background = "#f0f4ff";
                    }}
                    onMouseLeave={(e) => {
                      if (!isSel)
                        e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <div
                      style={{
                        flex: "3 1 0",
                        fontSize: 11,
                        color: C.text,
                        padding: "4px 4px",
                        whiteSpace: "normal",
                        lineHeight: 1.4,
                        wordBreak: "break-word" as const,
                      }}
                      title={c.text}
                    >
                      <span
                        style={{ color: C.muted, fontSize: 9, marginRight: 3 }}
                      >
                        #{c.post_id}
                      </span>
                      {c.text}
                    </div>
                    <div
                      style={{
                        flex: "0 0 55px",
                        fontSize: 11,
                        textAlign: "right",
                        padding: "2px 4px",
                      }}
                    >
                      <span
                        style={{ color: vc(c.verity_score), fontWeight: 600 }}
                      >
                        {c.verity_score > 0 ? "+" : ""}
                        {c.verity_score.toFixed(1)}%
                      </span>
                    </div>
                    <div
                      style={{
                        flex: "0 0 55px",
                        fontSize: 11,
                        textAlign: "right",
                        padding: "2px 4px",
                        color: C.text,
                      }}
                    >
                      {c.total_stake.toFixed(2)}
                    </div>
                    <div
                      style={{
                        flex: "0 0 55px",
                        fontSize: 11,
                        textAlign: "right",
                        padding: "2px 4px",
                        color: C.text,
                      }}
                    >
                      {c.controversy.toFixed(2)}
                    </div>
                    <div
                      style={{
                        flex: "1 1 0",
                        fontSize: 10,
                        color: "#6b7280",
                        padding: "2px 4px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {c.topic || "—"}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Footer — selected claim + confirm */}
        <div
          style={{
            padding: "8px 16px",
            borderTop: `1px solid ${C.gb}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
            background: "#f8fafc",
          }}
        >
          <div
            style={{ fontSize: 11, color: C.text, flex: 1, overflow: "hidden" }}
          >
            {selectedClaim ? (
              <span>
                <strong>Selected:</strong> #{selectedClaim.post_id} —{" "}
                {selectedClaim.text}
                <span
                  style={{
                    color: vc(selectedClaim.verity_score),
                    fontWeight: 600,
                    marginLeft: 4,
                  }}
                >
                  VS {selectedClaim.verity_score > 0 ? "+" : ""}
                  {selectedClaim.verity_score.toFixed(1)}%
                </span>
              </span>
            ) : (
              <span style={{ color: C.muted }}>Click a claim to select it</span>
            )}
          </div>
          <div style={{ display: "flex", gap: 6, marginLeft: 8 }}>
            <button
              onClick={onClose}
              style={{
                padding: "5px 12px",
                borderRadius: 5,
                border: `1px solid ${C.gb}`,
                fontSize: 11,
                cursor: "pointer",
                background: "#fff",
                color: C.text,
              }}
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (selectedClaim) onPick(selectedClaim);
              }}
              disabled={!selectedClaim}
              style={{
                padding: "5px 12px",
                borderRadius: 5,
                border: "none",
                fontSize: 11,
                fontWeight: 600,
                cursor: selectedClaim ? "pointer" : "not-allowed",
                background: selectedClaim ? "#2563eb" : "#d1d5db",
                color: "#fff",
                opacity: selectedClaim ? 1 : 0.6,
              }}
            >
              Select Claim
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
