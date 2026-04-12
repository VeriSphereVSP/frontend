// frontend/src/components/ClaimsExplorer.tsx — v2 redesign
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useAccount } from "wagmi";
import Jazzicon from "./Jazzicon";
import VSBar from "./VSBar";
import StakeControl from "./StakeControl";
import { PlusButton } from "./article";
import ClaimPickerModal from "./article/ClaimPickerModal";
import { useCreateLink, useStake } from "@verisphere/protocol";
import {
  S, GRID, LINK_GRID, formatAge,
  AddressTooltip, QueueView, Badge, ExpandedClaimDetail,
  type Claim,
} from "./claims-shared";


const API = import.meta.env.VITE_API_BASE || "/api";

type SortKey = "post_id" | "text" | "verity_score" | "total_stake" | "stake_support" | "stake_challenge" | "controversy" | "topic";
type SortDir = "asc" | "desc";

export default function ClaimsExplorer() {
  const { isConnected, address } = useAccount();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("total_stake");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filter, setFilter] = useState("");
  const [topicFilter, setTopicFilter] = useState("");
  const [showLinks, setShowLinks] = useState(true);
  const [showEmpty, setShowEmpty] = useState(false);
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
    if (!showLinks) list = list.filter(c => !c.is_link);
    if (!showEmpty) list = list.filter(c => c.total_stake > 0);
    if (filter.trim()) {
      const q = filter.toLowerCase();
      list = list.filter(c => c.text.toLowerCase().includes(q) || String(c.post_id).includes(q));
    }
    if (topicFilter) list = list.filter(c => c.topic === topicFilter);
    return list;
  }, [dedupClaims, filter, topicFilter, showLinks, showEmpty]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1; if (bv == null) return -1;
      const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir(key === "text" || key === "topic" ? "asc" : "desc"); }
  };

  // Pick up cross-view navigation target on mount
  useEffect(() => {
    const pending = (window as any).__claimsGoto;
    if (pending != null && dedupClaims.length > 0) {
      (window as any).__claimsGoto = undefined;
      setTimeout(() => handleGoTo(pending), 200);
    }
  }, [dedupClaims.length]);

  const handleGoTo = (postId: number) => {
    // Find the target post — if it's filtered out, enable the appropriate toggle
    const target = dedupClaims.find(c => c.post_id === postId);
    if (target) {
      if (target.is_link && !showLinks) setShowLinks(true);
      if (target.total_stake === 0 && !showEmpty) setShowEmpty(true);
    }
    setExpandedId(postId);
    setTimeout(() => {
      const el = document.getElementById(`claim-row-${postId}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 150);
  };

  const totalStake = dedupClaims.reduce((s, c) => s + c.total_stake, 0);
  const totalLinks = dedupClaims.reduce((s, c) => s + c.incoming_links + c.outgoing_links, 0) / 2; // Each link counted twice
  const avgVS = dedupClaims.length > 0 ? dedupClaims.reduce((s, c) => s + c.verity_score, 0) / dedupClaims.length : 0;
  const mostControversial = dedupClaims.length > 0 ? dedupClaims.reduce((a, b) => (a.controversy > b.controversy ? a : b)) : null;

  const COLS: { key: SortKey; label: string; align?: string }[] = [
    { key: "post_id", label: "#" },
    { key: "created_epoch" as SortKey, label: "Age" },
    { key: "text", label: "C/L" },
    { key: "text", label: "Claim / Link" },
    { key: "verity_score", label: "VS" },
    { key: "total_stake", label: "Stake" },
    { key: "stake_support", label: "Support" },
    { key: "stake_challenge", label: "Challenge" },
    { key: "post_id", label: "In", align: "right" },
    { key: "post_id", label: "Out", align: "right" },
    { key: "controversy", label: "Controv." },
    { key: "topic", label: "Topic" },
  ];

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px", display: "flex", flexDirection: "column" as const, height: "100%", minHeight: 0 }}>
      {/* Header */}
      <div style={{ marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: S.text, margin: "0 0 4px" }}>Claims Explorer</h1>
          <p style={{ fontSize: 13, color: S.textMuted, margin: 0 }}>All on-chain claims with live metrics from the protocol</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={fetchClaims} style={{ background: "none", border: `1px solid ${S.border}`, borderRadius: 6, padding: "5px 12px", fontSize: 12, color: S.textMuted, cursor: "pointer" }}>
            ↻ Refresh
          </button>
          {isConnected && <PlusButton onDone={fetchClaims} />}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
        {[
          { label: "Claims", value: String(dedupClaims.length) },
          { label: "Links", value: String(Math.round(totalLinks)) },
          { label: "Total Stake", value: `${totalStake >= 1000 ? (totalStake / 1000).toFixed(1) + "K" : totalStake.toFixed(1)} VSP` },
          { label: "Avg VS", value: `${avgVS >= 0 ? "+" : ""}${avgVS.toFixed(1)}%` },
          { label: "Most Controversial", value: mostControversial ? `#${mostControversial.post_id}` : "—" },
        ].map((s, i) => (
          <div key={i} style={{ padding: "10px 16px", background: S.bgAlt, borderRadius: 8, border: `1px solid ${S.border}`, minWidth: 90 }}>
            <div style={{ fontSize: 10, color: S.textFaint, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: ".04em", marginBottom: 2 }}>{s.label}</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: S.text }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
        <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search claims…"
          style={{ padding: "7px 12px", borderRadius: 6, border: `1px solid ${S.border}`, fontSize: 13, width: 220 }} />
        <select value={topicFilter} onChange={e => setTopicFilter(e.target.value)}
          style={{ padding: "7px 12px", borderRadius: 6, border: `1px solid ${S.border}`, fontSize: 13, background: "#fff" }}>
          <option value="">All topics</option>
          {topics.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <button onClick={fetchClaims} style={{ padding: "7px 14px", borderRadius: 6, border: `1px solid ${S.border}`, fontSize: 13, cursor: "pointer", background: "#fff", color: S.textMuted }}>
          Refresh
        </button>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: S.textMuted, cursor: "pointer" }}>
          <input type="checkbox" checked={showLinks} onChange={e => setShowLinks(e.target.checked)} />
          Show links
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: S.textMuted, cursor: "pointer" }}>
          <input type="checkbox" checked={showEmpty} onChange={e => setShowEmpty(e.target.checked)} />
          Show empty
        </label>
        <span style={{ fontSize: 12, color: S.textFaint }}>
          {sorted.length} {sorted.length === 1 ? "entry" : "entries"}{filter || topicFilter || !showLinks ? " (filtered)" : ""}
        </span>
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ padding: 40, textAlign: "center", color: S.textFaint }}>Loading claims…</div>
      ) : error ? (
        <div style={{ padding: 40, textAlign: "center", color: S.red }}>{error}</div>
      ) : sorted.length === 0 ? (
        <div style={{ padding: 40, textAlign: "center", color: S.textFaint }}>No claims found.</div>
      ) : (
        <div style={{ border: `1px solid ${S.border}`, borderRadius: 10, overflow: "hidden", display: "flex", flexDirection: "column" as const, flex: 1, minHeight: 0 }}>
          {/* Header */}
          <div style={{
            display: "grid", gridTemplateColumns: GRID,
            background: S.bgAlt, borderBottom: `2px solid ${S.border}`, padding: "0 16px",
          }}>
            {COLS.map((col, ci) => {
              // ci 0=#, 1=C/L, 2=Claim/Link, 3=VS, 4=Stake, 5=Sup, 6=Chal, 7=In, 8=Out, 9=Controv
              // Columns: 0=# 1=Age 2=C/L 3=Claim 4=VS 5=Stake 6=Support 7=Challenge 8=In 9=Out 10=Controv 11=Topic
              const align =
                ci === 0 ? "right" :       // # — right justify
                ci === 1 ? "right" :       // Age — right justify
                ci === 2 ? "left" :        // C/L badge — left
                ci === 3 ? "left" :        // Claim/Link — left
                ci === 4 ? "left" :        // VS — left-align header so it sits over start of bar
                ci === 8 || ci === 9 ? "right" :  // In/Out
                ci === 11 ? "right" :      // Topic — right justify
                "right";                    // Stake/Support/Challenge/Controv
              const headerPad =
                ci === 0 || ci === 1 ? "10px 8px 10px 4px" :  // # and Age extra right-pad
                ci === 4 ? "10px 4px 10px 14px" :              // VS shift left
                ci === 8 || ci === 9 ? "10px 10px 10px 4px" :  // In/Out right-pad
                "10px 4px";
              return (
                <div key={ci} onClick={() => ci > 1 ? toggleSort(col.key) : null} style={{
                  padding: headerPad, cursor: ci > 1 ? "pointer" : "default",
                  userSelect: "none" as const, whiteSpace: "nowrap" as const,
                  fontWeight: 600, fontSize: 10, textTransform: "uppercase" as const, letterSpacing: ".03em",
                  color: sortKey === col.key && ci > 1 ? S.blue : S.textFaint,
                  textAlign: align as any,
                }}>
                  {col.label}
                  {sortKey === col.key && ci > 1 && <span style={{ marginLeft: 2, fontSize: 9 }}>{sortDir === "asc" ? "▲" : "▼"}</span>}
                </div>
              );
            })}
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
                      padding: "8px 16px", cursor: "pointer",
                      borderBottom: isExpanded ? "none" : `1px solid ${S.borderLight}`,
                      background: isExpanded ? S.bgExpanded : i % 2 === 0 ? S.bgRow : S.bgAlt,
                      transition: "background 0.12s", alignItems: "center",
                    }}
                    onMouseEnter={e => { if (!isExpanded) e.currentTarget.style.background = S.bgHover; }}
                    onMouseLeave={e => { if (!isExpanded) e.currentTarget.style.background = isExpanded ? S.bgExpanded : i % 2 === 0 ? S.bgRow : S.bgAlt; }}
                  >
                    {/* # */}
                    <div style={{ fontSize: 11, color: S.textFaint, textAlign: "right", padding: "0 4px" }}>{c.post_id}</div>
                    {/* Age */}
                    <div style={{ fontSize: 10, color: S.textFaint, textAlign: "right", padding: "0 4px" }} title={c.created_epoch ? new Date(c.created_epoch * 1000).toLocaleString() : ""}>
                      {formatAge(c.created_epoch)}
                    </div>
                    {/* Badge */}
                    <div style={{ padding: "0 6px 0 4px", display: "flex", alignItems: "center", gap: 4 }}>
                      {c.creator && (
                        <AddressTooltip address={c.creator}>
                          <Jazzicon address={c.creator} size={16} />
                        </AddressTooltip>
                      )}
                      {c.is_link && <Badge type="link" />}
                    </div>
                    {/* Claim/Link text */}
                    <div style={{
                      fontSize: 13, color: S.text, padding: "0 8px", lineHeight: 1.5,
                      overflow: "hidden", textOverflow: "ellipsis",
                      whiteSpace: isExpanded ? "normal" : "nowrap",
                      fontWeight: isExpanded ? 500 : 400,
                      minWidth: 0,
                    }} title={c.is_link ? `${c.from_text} ${c.is_challenge ? "challenges" : "supports"} ${c.to_text}` : c.text}>
                      {c.is_link ? (
                        <>
                          <span style={{ fontWeight: 500, color: c.is_challenge ? S.red : S.green }}>
                            {c.is_challenge ? "Challenge" : "Support"}:
                          </span>{" "}
                          <span
                            style={{ cursor: "pointer", borderBottom: `1px dotted ${S.textFaint}` }}
                            onClick={(ev) => { ev.stopPropagation(); if (c.from_post_id) handleGoTo(c.from_post_id); }}
                            title="Go to source claim"
                          >"{c.from_text}"</span>{" "}
                          <span style={{ color: S.textFaint }}>{c.is_challenge ? "challenges" : "supports"}</span>{" "}
                          <span
                            style={{ cursor: "pointer", borderBottom: `1px dotted ${S.textFaint}` }}
                            onClick={(ev) => { ev.stopPropagation(); if (c.to_post_id) handleGoTo(c.to_post_id); }}
                            title="Go to target claim"
                          >"{c.to_text}"</span>
                        </>
                      ) : c.text}
                    </div>
                    {/* VS */}
                    <div style={{ display: "flex", justifyContent: "center", padding: "0 2px" }}>
                      <VSBar vs={c.verity_score} width={60} height={22} />
                    </div>
                    {/* Stake */}
                    <div style={{ fontSize: 11, color: S.text, textAlign: "right", padding: "0 4px", fontWeight: 500 }}>
                      {c.total_stake.toFixed(1)}
                    </div>
                    {/* Support */}
                    <div style={{ fontSize: 11, color: S.green, textAlign: "right", padding: "0 4px" }}>
                      {c.stake_support.toFixed(1)}
                    </div>
                    {/* Challenge */}
                    <div style={{ fontSize: 11, color: S.red, textAlign: "right", padding: "0 4px" }}>
                      {c.stake_challenge.toFixed(1)}
                    </div>
                    {/* Links in */}
                    <div style={{ fontSize: 11, color: S.textMuted, textAlign: "right", padding: "0 10px 0 4px" }}>
                      {c.incoming_links || ""}
                    </div>
                    {/* Links out */}
                    <div style={{ fontSize: 11, color: S.textMuted, textAlign: "right", padding: "0 10px 0 4px" }}>
                      {c.outgoing_links || ""}
                    </div>
                    {/* Controversy */}
                    <div style={{ fontSize: 11, color: S.textMuted, textAlign: "right", padding: "0 4px" }}>
                      {c.controversy > 0 ? c.controversy.toFixed(2) : ""}
                    </div>
                    {/* Topic */}
                    <div style={{ fontSize: 10, padding: "0 6px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textAlign: "right" }}>
                      {c.topic ? (
                        <a href="#" onClick={e => { e.preventDefault(); e.stopPropagation();
                          window.dispatchEvent(new CustomEvent("verisphere:navigate", { detail: { topic: c.topic } }));
                        }} style={{ color: S.blue, textDecoration: "none" }} title={`Open article: ${c.topic}`}>
                          {c.topic}
                        </a>
                      ) : <span style={{ color: S.textFaint }}>—</span>}
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <ExpandedClaimDetail
                      claim={c}
                      onRefresh={fetchClaims}
                      onClose={() => setExpandedId(null)}
                      onGoTo={handleGoTo}
                    />
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
