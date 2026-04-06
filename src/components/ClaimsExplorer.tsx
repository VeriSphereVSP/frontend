// frontend/src/components/ClaimsExplorer.tsx — Redesigned
import { useState, useEffect, useMemo, useCallback } from "react";
import { useAccount } from "wagmi";
import Jazzicon from "./Jazzicon";
import VSBar from "./VSBar";
import StakeControl from "./StakeControl";
import { PlusButton } from "./article";

const API = import.meta.env.VITE_API_BASE || "/api";

type Claim = {
  post_id: number;
  text: string;
  creator?: string;
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

type SortKey = "post_id" | "text" | "verity_score" | "controversy" | "stake_support" | "stake_challenge" | "topic";
type SortDir = "asc" | "desc";

const GRID = "28px minmax(0, 1fr) 62px 60px 56px 56px 100px";
const LINK_GRID = "28px minmax(0, 1fr) 62px 60px 56px 56px 100px";

/* ── Expanded Claim Detail ── */
function ExpandedClaimDetail({ claim: c, onRefresh, onClose, onGoTo }: {
  claim: Claim; onRefresh: () => void; onClose: () => void;
  onGoTo: (postId: number) => void;
}) {
  const [edges, setEdges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stakingLinkId, setStakingLinkId] = useState<number | null>(null);
  const [showQueue, setShowQueue] = useState(false);
  const [queueData, setQueueData] = useState<any>(null);
  const { isConnected, address } = useAccount();
  const [linkSearch, setLinkSearch] = useState("");
  const [linkResults, setLinkResults] = useState<any[]>([]);
  const [linking, setLinking] = useState(false);

  const refreshEdges = useCallback(async () => {
    try {
      const res = await fetch(`${API}/claims/${c.post_id}/edges?direction=incoming`).then(r => r.json());
      setEdges(res.incoming || []);
    } catch {}
    setLoading(false);
  }, [c.post_id]);

  useEffect(() => { refreshEdges(); }, [refreshEdges]);

  // Link search
  useEffect(() => {
    const q = linkSearch.trim();
    if (q.length < 2) { setLinkResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${API}/claims/search?q=${encodeURIComponent(q)}&limit=8`).then(r => r.json());
        setLinkResults((res.claims || []).filter((x: any) => x.post_id !== c.post_id));
      } catch { setLinkResults([]); }
    }, 300);
    return () => clearTimeout(t);
  }, [linkSearch, c.post_id]);

  const doCreateLink = async (fromId: number, toId: number, isChallenge: boolean) => {
    try {
      setLinking(true);
      await fetch(`${API}/links/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ independent_post_id: fromId, dependent_post_id: toId, is_challenge: isChallenge }),
      });
      setLinkSearch(""); setLinkResults([]);
      setTimeout(refreshEdges, 2000);
      setTimeout(onRefresh, 2000);
    } catch (e) { console.warn("Link creation failed:", e); }
    setLinking(false);
  };

  return (
    <div style={{ background: "#f8fafc", borderBottom: "1px solid #e5e7eb", padding: "0 12px 8px" }}>
      <div style={{ paddingLeft: 34 }}>
        {/* Stake control */}
        <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 0", fontSize: 11, color: "#6b7280" }}>
          <StakeControl
            postId={c.post_id}
            currentSupport={c.stake_support}
            currentChallenge={c.stake_challenge}
            postTotal={c.stake_support + c.stake_challenge}
            onDone={onRefresh}
            compact
            label="Your stake on this claim:"
          />
          <span style={{ fontSize: 9, color: "#9ca3af", cursor: "pointer" }}
            onClick={async () => {
              if (showQueue) { setShowQueue(false); return; }
              try {
                const res = await fetch(`${API}/claims/${c.post_id}/stakes?user=${address || ""}`);
                const data = await res.json();
                // Also fetch user stakes from the indexed DB
                const qRes = await fetch(`${API}/claims/${c.post_id}/user-stake?user=${address || ""}`);
                const qData = await qRes.ok ? await qRes.json() : {};
                setQueueData({ ...data, userStake: qData });
                setShowQueue(true);
              } catch { setShowQueue(true); setQueueData(null); }
            }}
          >{showQueue ? "hide queue" : "queue →"}</span>
        </div>

        {/* Incoming evidence */}
        {showQueue && queueData && (
          <div style={{ padding: "6px 0", fontSize: 11, color: "#6b7280", background: "#f0f4ff", borderRadius: 4, margin: "4px 0", padding: "8px 10px" }}>
            <div style={{ fontWeight: 500, marginBottom: 4, color: "#374151" }}>Stake queue — Post #{c.post_id}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 60px 60px", gap: "2px 8px", fontSize: 10 }}>
              <div style={{ fontWeight: 600, color: "#9ca3af" }}>Side</div>
              <div style={{ fontWeight: 600, color: "#9ca3af", textAlign: "right" }}>Support</div>
              <div style={{ fontWeight: 600, color: "#9ca3af", textAlign: "right" }}>Challenge</div>
              <div>Total staked</div>
              <div style={{ textAlign: "right", color: "#16a34a" }}>{(queueData.stake_support ?? 0).toFixed(2)}</div>
              <div style={{ textAlign: "right", color: "#dc2626" }}>{(queueData.stake_challenge ?? 0).toFixed(2)}</div>
              {address && <>
                <div>Your position</div>
                <div style={{ textAlign: "right", color: "#16a34a" }}>{(queueData.user_support ?? 0).toFixed(2)}</div>
                <div style={{ textAlign: "right", color: "#dc2626" }}>{(queueData.user_challenge ?? 0).toFixed(2)}</div>
              </>}
            </div>
            <div style={{ fontSize: 9, color: "#9ca3af", marginTop: 4 }}>
              VS: {(queueData.verity_score ?? 0).toFixed(1)}%
            </div>
          </div>
        )}

        <div style={{ fontSize: 10, fontWeight: 500, color: "#9ca3af", textTransform: "uppercase" as const, letterSpacing: ".04em", padding: "8px 0 3px" }}>
          Incoming evidence
        </div>

        {edges.length === 0 && !loading && (
          <div style={{ fontSize: 11, color: "#9ca3af", fontStyle: "italic", padding: "2px 0" }}>No incoming links</div>
        )}

        {edges.map((e: any) => {
          const isC = e.is_challenge;
          const isStaking = stakingLinkId === e.link_post_id;
          // Compute link effect (approximate: link_vs * claim_vs * weight)
          const linkVS = (e.link_vs ?? 0) / 100;
          const claimVS = (e.claim_vs ?? 0) / 100;
          const linkStake = (e.link_support ?? 0) + (e.link_challenge ?? 0);
          const effect = linkVS * claimVS * Math.min(linkStake, 10);
          const effectStr = (effect >= 0 ? "+" : "") + effect.toFixed(1);

          return (
            <div key={e.link_post_id}>
              <div
                onClick={(ev) => { ev.stopPropagation(); setStakingLinkId(isStaking ? null : e.link_post_id); }}
                style={{
                  display: "grid",
                  gridTemplateColumns: LINK_GRID,
                  padding: "4px 0",
                  marginLeft: -34,
                  cursor: "pointer",
                  borderRadius: 4,
                  alignItems: "start",
                }}
                onMouseEnter={(ev) => { ev.currentTarget.style.background = "#fff"; }}
                onMouseLeave={(ev) => { ev.currentTarget.style.background = "transparent"; }}
              >
                <div style={{ fontSize: 12, color: "#9ca3af", textAlign: "center", paddingTop: 2 }}>↳</div>
                <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.4 }}>
                  <span style={{ fontSize: 11, fontWeight: 500, fontStyle: "italic", color: isC ? "#dc2626" : "#16a34a" }}>
                    {isC ? "challenge" : "support"}
                  </span>
                  {" — "}{e.claim_text || `#${e.claim_post_id}`}
                </div>
                <div style={{ fontSize: 9, color: "#9ca3af", fontStyle: "italic", textAlign: "right", padding: "0 3px" }}>
                  link effect {effectStr}
                </div>
                <div style={{ fontSize: 11, color: "#6b7280", textAlign: "right", padding: "0 3px" }}>
                  {linkStake.toFixed(2)}
                </div>
                <div style={{ fontSize: 11, color: "#6b7280", textAlign: "right", padding: "0 3px" }}>
                  {(e.link_support ?? 0).toFixed(2)}
                </div>
                <div style={{ fontSize: 11, color: "#6b7280", textAlign: "right", padding: "0 3px" }}>
                  {(e.link_challenge ?? 0).toFixed(2)}
                </div>
                <div style={{ textAlign: "right", padding: "0 3px" }}>
                  <span
                    style={{ fontSize: 9, color: "#9ca3af", cursor: "pointer" }}
                    onClick={(ev) => { ev.stopPropagation(); onGoTo(e.claim_post_id); }}
                    onMouseEnter={(ev) => { (ev.target as HTMLElement).style.color = "#2563eb"; }}
                    onMouseLeave={(ev) => { (ev.target as HTMLElement).style.color = "#9ca3af"; }}
                  >go to →</span>
                </div>
              </div>
              {/* Link staking widget */}
              {isStaking && isConnected && (
                <div onClick={(ev) => ev.stopPropagation()} style={{
                  margin: "2px 0 4px 0", padding: "4px 8px",
                  background: "rgba(59,130,246,0.04)", borderRadius: 4,
                  border: "1px solid rgba(59,130,246,0.08)",
                  fontSize: 11, color: "#6b7280",
                  display: "flex", alignItems: "center", gap: 5,
                }}>
                  <StakeControl
                    postId={e.link_post_id}
                    currentSupport={e.link_support ?? 0}
                    currentChallenge={e.link_challenge ?? 0}
                    postTotal={(e.link_support ?? 0) + (e.link_challenge ?? 0)}
                    onDone={() => { setStakingLinkId(null); refreshEdges(); onRefresh(); }}
                    compact
                    label="Your stake on this link:"
                  />
                </div>
              )}
            </div>
          );
        })}

        {/* Link creation search */}
        {isConnected && (
          <div style={{ padding: "6px 0 2px", position: "relative" }}>
            <input
              value={linkSearch}
              onChange={(e) => setLinkSearch(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              placeholder="Search claim to link as evidence…"
              style={{
                width: "100%", padding: "4px 8px", borderRadius: 4,
                border: "1px solid #e5e7eb", fontSize: 11, boxSizing: "border-box" as const,
              }}
            />
            {linkResults.length > 0 && (
              <div style={{
                position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50,
                background: "#fff", border: "1px solid #e5e7eb", borderRadius: "0 0 4px 4px",
                maxHeight: 150, overflowY: "auto", boxShadow: "0 3px 8px rgba(0,0,0,.08)",
              }}>
                {linkResults.map((r: any) => (
                  <div key={r.post_id} style={{ display: "flex", gap: 4, padding: "4px 6px", fontSize: 11, cursor: "pointer", borderBottom: "1px solid #f5f5f5" }}
                    onClick={(ev) => ev.stopPropagation()}
                    onMouseEnter={(ev) => { ev.currentTarget.style.background = "#f0f4ff"; }}
                    onMouseLeave={(ev) => { ev.currentTarget.style.background = "#fff"; }}
                  >
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      #{r.post_id} {r.text}
                    </span>
                    <button onClick={(ev) => { ev.stopPropagation(); doCreateLink(r.post_id, c.post_id, false); }}
                      style={{ fontSize: 9, padding: "1px 6px", borderRadius: 3, border: "1px solid #16a34a", color: "#16a34a", background: "#fff", cursor: "pointer", whiteSpace: "nowrap" }}
                      disabled={linking}>✓ support</button>
                    <button onClick={(ev) => { ev.stopPropagation(); doCreateLink(r.post_id, c.post_id, true); }}
                      style={{ fontSize: 9, padding: "1px 6px", borderRadius: 3, border: "1px solid #dc2626", color: "#dc2626", background: "#fff", cursor: "pointer", whiteSpace: "nowrap" }}
                      disabled={linking}>✗ challenge</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {loading && <div style={{ fontSize: 10, color: "#9ca3af", padding: "4px 0" }}>Loading links…</div>}
      </div>
    </div>
  );
}

/* ── Main Component ── */
export default function ClaimsExplorer() {
  const { isConnected } = useAccount();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("stake_support");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filter, setFilter] = useState("");
  const [topicFilter, setTopicFilter] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchClaims = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API}/claims/fast/all?limit=500`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setClaims(data.claims || []);
    } catch (e: any) {
      setError(e.message || "Failed to load claims");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchClaims(); }, [fetchClaims]);

  const dedupClaims = useMemo(() => {
    const seen = new Map<number, Claim>();
    for (const c of claims) {
      if (!seen.has(c.post_id)) { seen.set(c.post_id, c); }
      else {
        const existing = seen.get(c.post_id)!;
        if (c.topic && (!existing.topic || c.topic.length < existing.topic.length)) seen.set(c.post_id, c);
      }
    }
    return Array.from(seen.values());
  }, [claims]);

  const topics = useMemo(() => {
    const set = new Set(dedupClaims.map(c => c.topic).filter(Boolean));
    return Array.from(set).sort();
  }, [dedupClaims]);

  const filtered = useMemo(() => {
    let list = dedupClaims;
    if (filter.trim()) {
      const q = filter.toLowerCase();
      list = list.filter(c => c.text.toLowerCase().includes(q) || String(c.post_id).includes(q));
    }
    if (topicFilter) list = list.filter(c => c.topic === topicFilter);
    return list;
  }, [dedupClaims, filter, topicFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir(key === "text" || key === "topic" ? "asc" : "desc"); }
  };

  const handleGoTo = (postId: number) => {
    setExpandedId(postId);
    // Scroll to the claim row
    setTimeout(() => {
      const el = document.getElementById(`claim-row-${postId}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

  const totalStake = dedupClaims.reduce((s, c) => s + c.total_stake, 0);
  const avgVS = dedupClaims.length > 0 ? dedupClaims.reduce((s, c) => s + c.verity_score, 0) / dedupClaims.length : 0;
  const mostControversial = dedupClaims.length > 0 ? dedupClaims.reduce((a, b) => (a.controversy > b.controversy ? a : b)) : null;

  const COLS: { key: SortKey; label: string }[] = [
    { key: "post_id", label: "#" },
    { key: "text", label: "Claim" },
    { key: "verity_score", label: "VS" },
    { key: "controversy", label: "Controv." },
    { key: "stake_support", label: "Support" },
    { key: "stake_challenge", label: "Challenge" },
    { key: "topic", label: "" },
  ];

  return (
    <div style={{ width: "100%", maxWidth: 1100, margin: "0 auto", padding: "24px 16px", display: "flex", flexDirection: "column" as const, height: "100%", minHeight: 0 }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1a1a2e", margin: "0 0 4px" }}>Claims Explorer</h1>
            <p style={{ fontSize: 13, color: "#6b7280", margin: 0 }}>All on-chain claims with live metrics from the protocol.</p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button onClick={fetchClaims} style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 12px", fontSize: 12, color: "#6b7280", cursor: "pointer" }}>↻ Refresh</button>
            {isConnected && <PlusButton onDone={fetchClaims} />}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
        {[
          { label: "Claims", value: String(dedupClaims.length) },
          { label: "Total Staked", value: `${totalStake.toFixed(1)} VSP` },
          { label: "Avg VS", value: `${avgVS >= 0 ? "+" : ""}${avgVS.toFixed(1)}%` },
          { label: "Most Controversial", value: mostControversial ? `#${mostControversial.post_id}` : "—" },
        ].map((s, i) => (
          <div key={i} style={{ padding: "8px 14px", background: "#f8fafc", borderRadius: 6, border: "1px solid #e5e7eb", minWidth: 100 }}>
            <div style={{ fontSize: 10, color: "#9ca3af", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: ".04em" }}>{s.label}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#1a1a2e" }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
        <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search claims…"
          style={{ padding: "6px 10px", borderRadius: 5, border: "1px solid #d1d5db", fontSize: 13, width: 240 }} />
        <select value={topicFilter} onChange={e => setTopicFilter(e.target.value)}
          style={{ padding: "6px 10px", borderRadius: 5, border: "1px solid #d1d5db", fontSize: 13, background: "#fff" }}>
          <option value="">All topics</option>
          {topics.map(t => <option key={t} value={t}>{t.length > 40 ? t.slice(0, 37) + "…" : t}</option>)}
        </select>
        <button onClick={fetchClaims} style={{ padding: "6px 14px", borderRadius: 5, border: "1px solid #d1d5db", fontSize: 13, cursor: "pointer", background: "#fff" }}>↻ Refresh</button>
        <span style={{ fontSize: 12, color: "#9ca3af" }}>{sorted.length} claim{sorted.length !== 1 ? "s" : ""}{filter || topicFilter ? " (filtered)" : ""}</span>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Loading claims…</div>
      ) : error ? (
        <div style={{ padding: 40, textAlign: "center", color: "#ef4444" }}>{error}</div>
      ) : sorted.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>No claims found.</div>
      ) : (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden", display: "flex", flexDirection: "column" as const, flex: 1, minHeight: 0 }}>
          {/* Header row */}
          <div style={{
            display: "grid", gridTemplateColumns: GRID,
            background: "#f8fafc", borderBottom: "2px solid #e5e7eb", padding: "0 12px",
          }}>
            {COLS.map(col => (
              <div key={col.key} onClick={() => toggleSort(col.key)} style={{
                padding: "8px 3px", cursor: "pointer", userSelect: "none" as const, whiteSpace: "nowrap" as const,
                fontWeight: 600, fontSize: 10, textTransform: "uppercase" as const, letterSpacing: ".03em",
                color: sortKey === col.key ? "#2563eb" : "#9ca3af",
                textAlign: col.key === "text" ? "left" as const : col.key === "verity_score" ? "center" as const : "right" as const,
              }}>
                {col.label}
                {sortKey === col.key && <span style={{ marginLeft: 2, fontSize: 9 }}>{sortDir === "asc" ? "▲" : "▼"}</span>}
              </div>
            ))}
          </div>

          {/* Data rows */}
          <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
            {sorted.map((c, i) => {
              const isExpanded = expandedId === c.post_id;
              return (
                <div key={c.post_id} id={`claim-row-${c.post_id}`}>
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : c.post_id)}
                    style={{
                      display: "grid", gridTemplateColumns: GRID,
                      padding: "7px 12px", cursor: "pointer",
                      borderBottom: isExpanded ? "none" : "1px solid #f0f0f0",
                      background: isExpanded ? "#f0f4ff" : i % 2 === 0 ? "#fff" : "#fafbfc",
                      transition: "background 0.1s", alignItems: "center",
                    }}
                    onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = "#f0f4ff"; }}
                    onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = i % 2 === 0 ? "#fff" : "#fafbfc"; }}
                  >
                    {/* # */}
                    <div style={{ fontSize: 11, color: "#9ca3af", textAlign: "right", padding: "0 3px" }}>{c.post_id}</div>
                    {/* Text */}
                    <div style={{
                      fontSize: 12, color: "#374151", padding: "0 6px", lineHeight: 1.4,
                      overflow: "hidden",
                      textOverflow: isExpanded ? "unset" : "ellipsis",
                      whiteSpace: isExpanded ? "normal" : "nowrap",
                      minWidth: 0,
                      fontWeight: isExpanded ? 500 : 400,
                    }} title={c.text}>
                      <span style={{ display: "inline-flex", alignItems: "flex-start", gap: 4 }}>
                        {c.creator && <Jazzicon address={c.creator} size={14} />}
                        {isExpanded ? c.text : (c.text.length > 60 ? c.text.slice(0, 57) + "…" : c.text)}
                      </span>
                    </div>
                    {/* VS */}
                    <div style={{ padding: "0 3px", display: "flex", justifyContent: "center" }}>
                      <VSBar vs={c.verity_score} width={56} height={18} />
                    </div>

                    {/* Controversy */}
                    <div style={{ fontSize: 11, color: "#6b7280", textAlign: "right", padding: "0 3px" }}>{c.controversy.toFixed(2)}</div>
                    {/* Support */}
                    <div style={{ fontSize: 11, color: "#6b7280", textAlign: "right", padding: "0 3px" }}>{c.stake_support.toFixed(2)}</div>
                    {/* Challenge */}
                    <div style={{ fontSize: 11, color: "#6b7280", textAlign: "right", padding: "0 3px" }}>{c.stake_challenge.toFixed(2)}</div>
                    {/* Topic + close */}
                    <div style={{ textAlign: "right", padding: "0 3px", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
                      {c.topic ? (
                        <a href="#" onClick={e => { e.preventDefault(); e.stopPropagation();
                          window.dispatchEvent(new CustomEvent("verisphere:navigate", { detail: { topic: c.topic } }));
                        }} style={{ color: "#2563eb", textDecoration: "none", fontSize: 10, whiteSpace: "normal", wordBreak: "break-word" as const, lineHeight: 1.3 }} title={`Open article: ${c.topic}`}>
                          {c.topic}
                        </a>
                      ) : <span style={{ color: "#d1d5db" }}>—</span>}
                      {isExpanded && (
                        <span onClick={e => { e.stopPropagation(); setExpandedId(null); }}
                          style={{ cursor: "pointer", fontSize: 12, color: "#9ca3af", fontWeight: 700 }} title="Close">✕</span>
                      )}
                    </div>
                  </div>
                  {isExpanded && (
                    <ExpandedClaimDetail claim={c} onRefresh={fetchClaims} onClose={() => setExpandedId(null)} onGoTo={handleGoTo} />
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
