// frontend/src/components/ClaimsExplorer.tsx — v2 redesign
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
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

type Edge = {
  claim_post_id: number;
  link_post_id: number;
  is_challenge: boolean;
  claim_text: string;
  claim_vs: number;
  claim_support: number;
  claim_challenge: number;
  link_support: number;
  link_challenge: number;
  link_vs: number;
};

type QueueEntry = {
  address: string;
  amount: number;
  position: number;
  entry_epoch: number;
  tranche: number;
  position_weight: number;
};

type SortKey = "post_id" | "text" | "verity_score" | "total_stake" | "stake_support" | "stake_challenge" | "controversy" | "topic";
type SortDir = "asc" | "desc";

// ── Styles ──────────────────────────────────────────
const S = {
  // Comfortable, readable palette
  text: "#2d3748",
  textMuted: "#718096",
  textFaint: "#a0aec0",
  border: "#e2e8f0",
  borderLight: "#edf2f7",
  bgRow: "#ffffff",
  bgAlt: "#f7fafc",
  bgExpanded: "#f0f5ff",
  bgHover: "#edf2f7",
  green: "#38a169",
  greenLight: "#c6f6d5",
  red: "#e53e3e",
  redLight: "#fed7d7",
  blue: "#3182ce",
  blueLight: "#ebf4ff",
};

const GRID = "32px 40px minmax(0,1fr) 72px 54px 54px 54px 36px 36px 52px";
const LINK_GRID = "32px 40px minmax(0,1fr) 72px 54px 54px 54px 36px 36px 52px";

// ── Copyable Address Tooltip ────────────────────────
function AddressTooltip({ address, children }: { address: string; children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <span style={{ position: "relative", display: "inline-block" }} title={address} onClick={(e) => { e.stopPropagation(); copy(); }}>
      {children}
      {copied && (
        <span style={{
          position: "absolute", bottom: "100%", left: "50%", transform: "translateX(-50%)",
          background: S.text, color: "#fff", fontSize: 9, padding: "2px 6px", borderRadius: 3,
          whiteSpace: "nowrap", pointerEvents: "none",
        }}>Copied!</span>
      )}
    </span>
  );
}

// ── Queue Display ───────────────────────────────────
function QueueView({ postId, connectedAddress }: { postId: number; connectedAddress?: string }) {
  const [data, setData] = useState<{ support: QueueEntry[]; challenge: QueueEntry[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/claims/${postId}/queue`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [postId]);

  if (loading) return <div style={{ fontSize: 11, color: S.textFaint, padding: "8px 0" }}>Loading queue…</div>;
  if (!data) return <div style={{ fontSize: 11, color: S.textFaint, padding: "8px 0" }}>Queue unavailable</div>;

  const renderSide = (label: string, entries: QueueEntry[], color: string, lightColor: string) => (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color, marginBottom: 6 }}>{label}</div>
      {entries.length === 0 ? (
        <div style={{ fontSize: 11, color: S.textFaint, fontStyle: "italic" }}>No stakers</div>
      ) : (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {entries.map((e, i) => {
            const isMe = connectedAddress && e.address.toLowerCase() === connectedAddress.toLowerCase();
            return (
              <AddressTooltip key={i} address={e.address}>
                <div style={{
                  display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 2,
                  padding: "6px 8px", borderRadius: 8,
                  background: isMe ? lightColor : "#fff",
                  border: `1.5px solid ${isMe ? color : S.border}`,
                  cursor: "pointer", minWidth: 48,
                  transition: "border-color 0.15s",
                }}>
                  <Jazzicon address={e.address} size={24} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: S.text }}>{e.amount.toFixed(1)}</span>
                  <span style={{ fontSize: 8, color: S.textFaint }}>T{e.tranche} ×{e.position_weight}</span>
                </div>
              </AddressTooltip>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ padding: "8px 0" }}>
      {renderSide("Support", data.support, S.green, S.greenLight)}
      {renderSide("Challenge", data.challenge, S.red, S.redLight)}
    </div>
  );
}

// ── Badge ───────────────────────────────────────────
function Badge({ type }: { type: "claim" | "link" }) {
  const isClaim = type === "claim";
  return (
    <span style={{
      fontSize: 9, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: ".04em",
      padding: "1px 5px", borderRadius: 3,
      color: isClaim ? S.textMuted : S.blue,
      background: isClaim ? S.borderLight : S.blueLight,
    }}>{type}</span>
  );
}

// ── Expanded Claim Detail ───────────────────────────
function ExpandedClaimDetail({ claim: c, onRefresh, onClose, onGoTo }: {
  claim: Claim; onRefresh: () => void; onClose: () => void;
  onGoTo: (postId: number) => void;
}) {
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(true);
  const [showQueue, setShowQueue] = useState(false);
  const [stakingLinkId, setStakingLinkId] = useState<number | null>(null);
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
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ independent_post_id: fromId, dependent_post_id: toId, is_challenge: isChallenge }),
      });
      setLinkSearch(""); setLinkResults([]);
      setTimeout(refreshEdges, 2000);
      setTimeout(onRefresh, 2000);
    } catch (e) { console.warn("Link creation failed:", e); }
    setLinking(false);
  };

  return (
    <div style={{ background: S.bgExpanded, borderBottom: `1px solid ${S.border}`, padding: "10px 16px" }}>
      {/* Staking row */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
        <StakeControl
          postId={c.post_id}
          currentSupport={c.stake_support}
          currentChallenge={c.stake_challenge}
          postTotal={c.stake_support + c.stake_challenge}
          onDone={onRefresh}
          compact
          label="Your stake on this claim:"
        />
        <span
          style={{ fontSize: 10, color: S.textFaint, cursor: "pointer", marginLeft: 4, textDecoration: showQueue ? "underline" : "none" }}
          onClick={() => setShowQueue(!showQueue)}
        >{showQueue ? "Hide queues" : "Queues"}</span>
      </div>

      {/* Queue view */}
      {showQueue && <QueueView postId={c.post_id} connectedAddress={address} />}

      {/* Link search / create */}
      {isConnected && (
        <div style={{ position: "relative", marginBottom: 8 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input
              value={linkSearch}
              onChange={(e) => setLinkSearch(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              placeholder="Search to link new claim…"
              style={{
                flex: 1, padding: "5px 10px", borderRadius: 5,
                border: `1px solid ${S.border}`, fontSize: 12, maxWidth: 320,
              }}
            />
            {linkSearch.trim().length > 0 && (
              <span style={{ fontSize: 10, color: S.textFaint }}>
                {linking ? "Creating…" : `${linkResults.length} results`}
              </span>
            )}
          </div>
          {linkResults.length > 0 && (
            <div style={{
              position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50, maxWidth: 500,
              background: "#fff", border: `1px solid ${S.border}`, borderRadius: "0 0 6px 6px",
              maxHeight: 180, overflowY: "auto", boxShadow: "0 4px 12px rgba(0,0,0,.08)",
            }}>
              {linkResults.map((r: any) => (
                <div key={r.post_id} style={{
                  display: "flex", gap: 6, padding: "6px 10px", fontSize: 12,
                  borderBottom: `1px solid ${S.borderLight}`, alignItems: "center",
                }}
                  onMouseEnter={(ev) => { ev.currentTarget.style.background = S.bgHover; }}
                  onMouseLeave={(ev) => { ev.currentTarget.style.background = "#fff"; }}
                >
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: S.text }}>
                    #{r.post_id} {r.text}
                  </span>
                  <button onClick={(ev) => { ev.stopPropagation(); doCreateLink(r.post_id, c.post_id, false); }}
                    style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, border: `1px solid ${S.green}`, color: S.green, background: "#fff", cursor: "pointer" }}
                    disabled={linking}>✓ Support</button>
                  <button onClick={(ev) => { ev.stopPropagation(); doCreateLink(r.post_id, c.post_id, true); }}
                    style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, border: `1px solid ${S.red}`, color: S.red, background: "#fff", cursor: "pointer" }}
                    disabled={linking}>✗ Challenge</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Incoming links as rows in the same grid */}
      {edges.map((e) => {
        const isC = e.is_challenge;
        const linkTotal = (e.link_support ?? 0) + (e.link_challenge ?? 0);
        const linkVS = e.link_vs ?? 0;
        // Approximate link effect
        const claimVS = Math.abs(e.claim_vs ?? 0) / 100;
        const linkVSFrac = Math.abs(linkVS) / 100;
        const weight = linkTotal > 0 ? Math.min(linkTotal / (c.stake_support + c.stake_challenge + 0.01), 1) : 0;
        const effect = linkVSFrac * claimVS * weight * (c.stake_support + c.stake_challenge);
        const effectStr = (isC ? "−" : "+") + effect.toFixed(1);
        const isStaking = stakingLinkId === e.link_post_id;

        return (
          <div key={e.link_post_id}>
            {/* Link row — same grid as claims */}
            <div
              style={{
                display: "grid", gridTemplateColumns: LINK_GRID,
                padding: "6px 0", alignItems: "center",
                cursor: "pointer", borderRadius: 4,
                background: isStaking ? S.blueLight : "transparent",
              }}
              onClick={() => setStakingLinkId(isStaking ? null : e.link_post_id)}
              onMouseEnter={(ev) => { if (!isStaking) ev.currentTarget.style.background = S.bgHover; }}
              onMouseLeave={(ev) => { if (!isStaking) ev.currentTarget.style.background = isStaking ? S.blueLight : "transparent"; }}
            >
              {/* # */}
              <div style={{ fontSize: 11, color: S.textFaint, textAlign: "right", padding: "0 4px" }}>{e.link_post_id}</div>
              {/* Badge */}
              <div style={{ padding: "0 4px" }}><Badge type="link" /></div>
              {/* Link text */}
              <div style={{ fontSize: 12, color: S.text, lineHeight: 1.5, padding: "0 6px" }}>
                <span style={{ fontWeight: 500, color: isC ? S.red : S.green }}>
                  {isC ? "Challenge" : "Support"}:
                </span>{" "}
                <span style={{ color: S.textMuted }}>"{e.claim_text}"</span>
                <span style={{ color: S.textFaint }}>{isC ? " challenges " : " supports "}</span>
                <span style={{ color: S.textMuted }}>"{c.text.length > 40 ? c.text.slice(0, 37) + "…" : c.text}"</span>
              </div>
              {/* VS */}
              <div style={{ display: "flex", justifyContent: "center", padding: "0 2px" }}>
                <VSBar vs={linkVS} width={60} height={20} />
              </div>
              {/* Stake */}
              <div style={{ fontSize: 11, color: S.text, textAlign: "right", padding: "0 4px" }}>
                {linkTotal.toFixed(1)}
              </div>
              {/* Support */}
              <div style={{ fontSize: 11, color: S.green, textAlign: "right", padding: "0 4px" }}>
                {(e.link_support ?? 0).toFixed(1)}
              </div>
              {/* Challenge */}
              <div style={{ fontSize: 11, color: S.red, textAlign: "right", padding: "0 4px" }}>
                {(e.link_challenge ?? 0).toFixed(1)}
              </div>
              {/* Link effect (spans Links in + Links out columns) */}
              <div style={{ fontSize: 9, color: S.textFaint, textAlign: "right", padding: "0 2px", gridColumn: "span 2" }}>
                Effect {effectStr}
              </div>
              {/* Controversy placeholder */}
              <div></div>
            </div>
            {/* Go to claim link */}
            <div style={{ paddingLeft: 76, paddingBottom: 4 }}>
              <span
                style={{ fontSize: 10, color: S.blue, cursor: "pointer" }}
                onClick={(ev) => { ev.stopPropagation(); onGoTo(e.claim_post_id); }}
                onMouseEnter={(ev) => { (ev.target as HTMLElement).style.textDecoration = "underline"; }}
                onMouseLeave={(ev) => { (ev.target as HTMLElement).style.textDecoration = "none"; }}
              >Go to claim →</span>
            </div>
            {/* Link staking */}
            {isStaking && isConnected && (
              <div style={{ padding: "4px 16px 8px 76px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <StakeControl
                    postId={e.link_post_id}
                    currentSupport={e.link_support ?? 0}
                    currentChallenge={e.link_challenge ?? 0}
                    postTotal={linkTotal}
                    onDone={() => { setStakingLinkId(null); refreshEdges(); onRefresh(); }}
                    compact
                    label="Your stake on this link:"
                  />
                </div>
                <QueueView postId={e.link_post_id} connectedAddress={address} />
              </div>
            )}
          </div>
        );
      })}

      {edges.length === 0 && !loading && (
        <div style={{ fontSize: 11, color: S.textFaint, fontStyle: "italic", padding: "4px 0" }}>No incoming links</div>
      )}
      {loading && <div style={{ fontSize: 11, color: S.textFaint, padding: "4px 0" }}>Loading links…</div>}
    </div>
  );
}

// ── Main Component ──────────────────────────────────
export default function ClaimsExplorer() {
  const { isConnected, address } = useAccount();
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("total_stake");
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
      if (av == null) return 1; if (bv == null) return -1;
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
    setTimeout(() => {
      const el = document.getElementById(`claim-row-${postId}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

  const totalStake = dedupClaims.reduce((s, c) => s + c.total_stake, 0);
  const totalLinks = dedupClaims.reduce((s, c) => s + c.incoming_links + c.outgoing_links, 0) / 2; // Each link counted twice
  const avgVS = dedupClaims.length > 0 ? dedupClaims.reduce((s, c) => s + c.verity_score, 0) / dedupClaims.length : 0;
  const mostControversial = dedupClaims.length > 0 ? dedupClaims.reduce((a, b) => (a.controversy > b.controversy ? a : b)) : null;

  const COLS: { key: SortKey; label: string; align?: string }[] = [
    { key: "post_id", label: "#" },
    { key: "text", label: "C/L" },
    { key: "text", label: "Claim / Link" },
    { key: "verity_score", label: "VS" },
    { key: "total_stake", label: "Stake" },
    { key: "stake_support", label: "Support" },
    { key: "stake_challenge", label: "Challenge" },
    { key: "post_id", label: "In", align: "right" },
    { key: "post_id", label: "Out", align: "right" },
    { key: "controversy", label: "Controv." },
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
        <span style={{ fontSize: 12, color: S.textFaint }}>
          {sorted.length} claim{sorted.length !== 1 ? "s" : ""}{filter || topicFilter ? " (filtered)" : ""}
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
            {COLS.map((col, ci) => (
              <div key={ci} onClick={() => ci > 1 ? toggleSort(col.key) : null} style={{
                padding: "10px 4px", cursor: ci > 1 ? "pointer" : "default",
                userSelect: "none" as const, whiteSpace: "nowrap" as const,
                fontWeight: 600, fontSize: 10, textTransform: "uppercase" as const, letterSpacing: ".03em",
                color: sortKey === col.key && ci > 1 ? S.blue : S.textFaint,
                textAlign: ci <= 2 ? "left" as const : "right" as const,
              }}>
                {col.label}
                {sortKey === col.key && ci > 1 && <span style={{ marginLeft: 2, fontSize: 9 }}>{sortDir === "asc" ? "▲" : "▼"}</span>}
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
                    {/* Badge */}
                    <div style={{ padding: "0 4px" }}>
                      {c.creator && <Jazzicon address={c.creator} size={16} />}
                    </div>
                    {/* Claim text */}
                    <div style={{
                      fontSize: 13, color: S.text, padding: "0 8px", lineHeight: 1.5,
                      overflow: "hidden", textOverflow: "ellipsis",
                      whiteSpace: isExpanded ? "normal" : "nowrap",
                      fontWeight: isExpanded ? 500 : 400,
                      minWidth: 0,
                    }} title={c.text}>
                      {c.text}
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
                    <div style={{ fontSize: 11, color: S.textMuted, textAlign: "right", padding: "0 4px" }}>
                      {c.incoming_links}
                    </div>
                    {/* Links out */}
                    <div style={{ fontSize: 11, color: S.textMuted, textAlign: "right", padding: "0 4px" }}>
                      {c.outgoing_links}
                    </div>
                    {/* Controversy */}
                    <div style={{ fontSize: 11, color: S.textMuted, textAlign: "right", padding: "0 4px" }}>
                      {c.controversy > 0 ? c.controversy.toFixed(2) : ""}
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
