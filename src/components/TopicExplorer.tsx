// frontend/src/components/TopicExplorer.tsx
import { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import { useCreateClaim } from "../web3/useCreateClaim";
import { useCreateLink } from "../web3/useCreateLink";
import { useStake } from "../web3/useStake";

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

// ── Types ──────────────────────────────────────────────────

type ClaimData = {
  text: string;
  post_id?: number | null;
  on_chain?: any;
  stake_support?: number;
  stake_challenge?: number;
  verity_score?: number;
  user_support?: number;
  user_challenge?: number;
  author?: string;
  confidence?: number;
};

type EdgeData = {
  claim_post_id: number;
  link_post_id: number;
  is_challenge: boolean;
  claim_text?: string;
  claim_vs?: number;
  claim_support?: number;
  claim_challenge?: number;
  link_support?: number;
  link_challenge?: number;
};

type TopicRow = {
  incumbent: ClaimData | null;
  challengers: ClaimData[];
};

// ── Style constants ────────────────────────────────────────

const COLORS = {
  green: "#059669",
  greenLight: "rgba(16, 185, 80, 0.12)",
  greenMid: "rgba(16, 185, 80, 0.25)",
  red: "#dc2626",
  redLight: "rgba(220, 50, 50, 0.08)",
  redMid: "rgba(220, 50, 50, 0.18)",
  gray: "#6b7280",
  grayLight: "#f3f4f6",
  grayBorder: "#e5e7eb",
  text: "#111827",
  textMuted: "#9ca3af",
  white: "#ffffff",
  chainBadge: "#3b82f6",
};

// ── Helpers ────────────────────────────────────────────────

function clean(n: number | undefined): number {
  const v = n ?? 0;
  return Math.abs(v) < 0.001 ? 0 : v;
}

function vsBackground(vs: number): string {
  if (vs > 50) return "rgba(16, 185, 80, 0.18)";
  if (vs > 20) return "rgba(16, 185, 80, 0.10)";
  if (vs > 0) return "rgba(16, 185, 80, 0.05)";
  if (vs < -50) return "rgba(220, 50, 50, 0.16)";
  if (vs < -20) return "rgba(220, 50, 50, 0.09)";
  if (vs < 0) return "rgba(220, 50, 50, 0.04)";
  return COLORS.grayLight;
}

function vsAccent(vs: number): string {
  if (vs > 0) return COLORS.green;
  if (vs < 0) return COLORS.red;
  return COLORS.gray;
}

function formatVS(vs: number, onChain: boolean): string {
  if (!onChain) return "—";
  return (vs >= 0 ? "+" : "") + vs.toFixed(0);
}

function isOnChain(claim: ClaimData): boolean {
  return claim.on_chain?.post_id != null || claim.post_id != null;
}

function getPostId(claim: ClaimData): number | null {
  return claim.on_chain?.post_id ?? claim.post_id ?? null;
}

// ── Shared inline styles ───────────────────────────────────

const S = {
  // Seed strip
  seedStrip: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
    gap: 8,
    padding: "0 0 20px",
  } as React.CSSProperties,

  seedChip: (active: boolean, vs: number, onChain: boolean) =>
    ({
      display: "flex",
      alignItems: "center",
      gap: 8,
      padding: "10px 14px",
      borderRadius: 10,
      border: active
        ? `2px solid ${vsAccent(vs)}`
        : `1px solid ${COLORS.grayBorder}`,
      background: vsBackground(vs),
      cursor: "pointer",
      transition: "all 0.15s",
      minHeight: 44,
    }) as React.CSSProperties,

  seedText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 1.4,
    color: COLORS.text,
  } as React.CSSProperties,

  // VS badge
  vsBadge: (vs: number, onChain: boolean) =>
    ({
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      minWidth: 36,
      height: 22,
      borderRadius: 11,
      fontSize: 11,
      fontWeight: 700,
      flexShrink: 0,
      background: onChain ? vsBackground(vs) : COLORS.grayLight,
      color: onChain ? vsAccent(vs) : COLORS.textMuted,
      border: onChain
        ? `1px solid ${vsAccent(vs)}33`
        : `1px solid ${COLORS.grayBorder}`,
    }) as React.CSSProperties,

  // Chain indicator
  chainDot: (onChain: boolean) =>
    ({
      width: 7,
      height: 7,
      borderRadius: "50%",
      background: onChain ? COLORS.chainBadge : COLORS.grayBorder,
      flexShrink: 0,
      title: onChain ? "On-chain" : "Off-chain",
    }) as React.CSSProperties,

  // Section divider
  divider: {
    height: 1,
    background: COLORS.grayBorder,
    margin: "16px 0",
  } as React.CSSProperties,

  // Focus card
  focusCard: (vs: number) =>
    ({
      padding: 24,
      borderRadius: 14,
      border: `1px solid ${COLORS.grayBorder}`,
      background: COLORS.white,
      marginBottom: 16,
    }) as React.CSSProperties,

  focusText: {
    fontSize: 17,
    lineHeight: 1.55,
    color: COLORS.text,
    fontWeight: 500,
    marginBottom: 16,
    padding: "12px 16px",
    borderRadius: 10,
  } as React.CSSProperties,

  // Evidence panel
  evidencePanel: {
    border: `1px solid ${COLORS.grayBorder}`,
    borderRadius: 14,
    background: COLORS.white,
    overflow: "hidden",
    marginBottom: 16,
  } as React.CSSProperties,

  evidenceTabs: {
    display: "flex",
    borderBottom: `1px solid ${COLORS.grayBorder}`,
  } as React.CSSProperties,

  evidenceTab: (active: boolean) =>
    ({
      flex: 1,
      padding: "12px 16px",
      fontSize: 13,
      fontWeight: 600,
      color: active ? COLORS.text : COLORS.gray,
      background: "none",
      border: "none",
      borderBottom: active
        ? `2px solid ${COLORS.text}`
        : "2px solid transparent",
      cursor: "pointer",
      textAlign: "center" as const,
      transition: "all 0.15s",
    }) as React.CSSProperties,

  evidenceRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: "12px 16px",
    borderBottom: `1px solid ${COLORS.grayLight}`,
    cursor: "pointer",
    transition: "background 0.1s",
  } as React.CSSProperties,

  evidenceEmpty: {
    padding: "32px 20px",
    textAlign: "center" as const,
    fontSize: 13,
    color: COLORS.textMuted,
  } as React.CSSProperties,

  // Stake panel
  stakePanel: {
    marginTop: 16,
    padding: "14px 16px",
    border: `1px solid ${COLORS.grayBorder}`,
    borderRadius: 10,
    background: "#fafafa",
  } as React.CSSProperties,

  stakeBar: {
    height: 6,
    borderRadius: 3,
    background: COLORS.redLight,
    overflow: "hidden" as const,
    marginBottom: 4,
  } as React.CSSProperties,

  stakeBarFill: (pct: number) =>
    ({
      height: "100%",
      width: `${pct}%`,
      background: COLORS.greenMid,
      borderRadius: 3,
      transition: "width 0.3s",
    }) as React.CSSProperties,

  // Breadcrumbs
  breadcrumbs: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    padding: "8px 0 12px",
    fontSize: 12,
    flexWrap: "wrap" as const,
  } as React.CSSProperties,

  breadcrumb: (current: boolean) =>
    ({
      background: "none",
      border: "none",
      padding: "2px 6px",
      fontSize: 12,
      color: current ? COLORS.text : COLORS.chainBadge,
      fontWeight: current ? 600 : 400,
      cursor: current ? "default" : "pointer",
      borderRadius: 4,
    }) as React.CSSProperties,

  // Link create
  linkCreate: {
    padding: "16px",
    borderTop: `1px solid ${COLORS.grayBorder}`,
    background: "#fafafa",
  } as React.CSSProperties,
};

// ── StakePanel ─────────────────────────────────────────────

function StakePanel({
  postId,
  label,
  supportTotal,
  challengeTotal,
  userSupport,
  userChallenge,
  onStaked,
}: {
  postId: number;
  label: string;
  supportTotal: number;
  challengeTotal: number;
  userSupport: number;
  userChallenge: number;
  onStaked?: () => void;
}) {
  const { isConnected } = useAccount();
  const { stake, withdraw, loading, error, txHash } = useStake();
  const [amount, setAmount] = useState("1");
  const [side, setSide] = useState<"support" | "challenge">("support");

  const total = supportTotal + challengeTotal;
  const supPct = total > 0 ? (supportTotal / total) * 100 : 50;
  const myStake = side === "support" ? userSupport : userChallenge;

  const handleStake = async () => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return;
    await stake(postId, side, amt);
    onStaked?.();
  };

  const handleUnstake = async () => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return;
    await withdraw(postId, side, amt);
    onStaked?.();
  };

  if (!isConnected) {
    return (
      <div
        style={{
          ...S.stakePanel,
          textAlign: "center",
          color: COLORS.textMuted,
          fontSize: 13,
          border: `1px dashed ${COLORS.grayBorder}`,
        }}
      >
        Connect wallet to stake on this {label}.
      </div>
    );
  }

  return (
    <div style={S.stakePanel}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: COLORS.gray,
          textTransform: "uppercase" as const,
          letterSpacing: "0.04em",
          marginBottom: 8,
        }}
      >
        Stake on this {label}
      </div>

      <div style={S.stakeBar}>
        <div style={S.stakeBarFill(supPct)} />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 11,
          marginBottom: 10,
        }}
      >
        <span style={{ color: COLORS.green }}>
          Support: {supportTotal.toFixed(1)}
        </span>
        <span style={{ color: COLORS.red }}>
          Challenge: {challengeTotal.toFixed(1)}
        </span>
      </div>

      {/* Side toggle */}
      <div
        style={{
          display: "flex",
          border: `1px solid ${COLORS.grayBorder}`,
          borderRadius: 6,
          overflow: "hidden" as const,
          marginBottom: 10,
        }}
      >
        {(["support", "challenge"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSide(s)}
            style={{
              flex: 1,
              padding: "6px 10px",
              fontSize: 12,
              fontWeight: 600,
              border: "none",
              background:
                side === s
                  ? s === "support"
                    ? COLORS.greenLight
                    : COLORS.redLight
                  : COLORS.white,
              color:
                side === s
                  ? s === "support"
                    ? COLORS.green
                    : COLORS.red
                  : COLORS.gray,
              cursor: "pointer",
              borderRight:
                s === "support" ? `1px solid ${COLORS.grayBorder}` : "none",
            }}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Amount + buttons */}
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input
          type="number"
          min="0.01"
          step="0.1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={{
            flex: 1,
            padding: "6px 10px",
            border: `1px solid ${COLORS.grayBorder}`,
            borderRadius: 6,
            fontSize: 13,
          }}
          placeholder="VSP"
        />
        <button
          className="btn btn-primary"
          onClick={handleStake}
          disabled={loading}
          style={{ padding: "6px 14px", fontSize: 12 }}
        >
          {loading ? "…" : "Stake"}
        </button>
        <button
          className="btn"
          onClick={handleUnstake}
          disabled={loading || myStake <= 0}
          style={{
            padding: "6px 14px",
            fontSize: 12,
            background: myStake > 0 ? "#fee" : "#f5f5f5",
            color: myStake > 0 ? COLORS.red : "#999",
            border: `1px solid ${myStake > 0 ? "#fcc" : "#ddd"}`,
          }}
        >
          Unstake
        </button>
      </div>

      {myStake > 0 && (
        <div
          style={{
            fontSize: 11,
            color: COLORS.gray,
            textAlign: "center",
            marginTop: 6,
          }}
        >
          Your {side}: {myStake.toFixed(2)} VSP
        </div>
      )}
      {error && (
        <div style={{ fontSize: 12, color: COLORS.red, marginTop: 6 }}>
          {error}
        </div>
      )}
      {txHash && (
        <div style={{ fontSize: 12, color: COLORS.green, marginTop: 6 }}>
          ✓ Tx: {txHash.slice(0, 14)}…
        </div>
      )}
    </div>
  );
}

// ── Breadcrumbs ────────────────────────────────────────────

function Breadcrumbs({
  trail,
  onNavigate,
}: {
  trail: { text: string }[];
  onNavigate: (index: number) => void;
}) {
  if (trail.length <= 1) return null;
  return (
    <div style={S.breadcrumbs}>
      {trail.map((item, i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "center" }}>
          {i > 0 && (
            <span style={{ color: COLORS.textMuted, margin: "0 2px" }}>›</span>
          )}
          <button
            style={S.breadcrumb(i === trail.length - 1)}
            onClick={() => onNavigate(i)}
            disabled={i === trail.length - 1}
          >
            {item.text.length > 35 ? item.text.slice(0, 33) + "…" : item.text}
          </button>
        </span>
      ))}
    </div>
  );
}

// ── LinkCreationPanel ──────────────────────────────────────

function LinkCreationPanel({
  focusPostId,
  focusText,
  onCreated,
}: {
  focusPostId: number;
  focusText: string;
  onCreated: () => void;
}) {
  const { isConnected } = useAccount();
  const {
    createClaim,
    loading: claimLoading,
    needsApproval: claimNeedsApproval,
    approveVSP: claimApprove,
  } = useCreateClaim();
  const { createLink, isLoading: linkLoading } = useCreateLink();
  const [text, setText] = useState("");
  const [linkType, setLinkType] = useState<"support" | "challenge">("support");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isConnected) return null;

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setError(null);
    try {
      if (claimNeedsApproval) {
        setStatus("Approving VSP…");
        await claimApprove();
      }
      setStatus("Creating claim…");
      const claimResult = await createClaim(text.trim());
      if (!claimResult) throw new Error("Claim creation failed");

      setStatus("Confirming, then linking…");
      await new Promise((r) => setTimeout(r, 4000));

      const res = await fetch(
        `${API_BASE}/claim-status/${encodeURIComponent(text.trim())}`,
      );
      const data = await res.json();
      const newPostId = data?.on_chain?.post_id;

      if (newPostId == null) {
        setStatus("Claim created. Link manually once indexed.");
        return;
      }

      await createLink(newPostId, focusPostId, linkType === "challenge");
      setStatus(null);
      setText("");
      onCreated();
    } catch (err: any) {
      setError(err.message || "Failed");
      setStatus(null);
    }
  };

  return (
    <div style={S.linkCreate}>
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: COLORS.gray,
          marginBottom: 8,
        }}
      >
        Add evidence for "
        {focusText.length > 45 ? focusText.slice(0, 43) + "…" : focusText}"
      </div>
      <textarea
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Write a claim that supports or challenges…"
        style={{
          width: "100%",
          padding: "8px 10px",
          border: `1px solid ${COLORS.grayBorder}`,
          borderRadius: 6,
          fontSize: 13,
          fontFamily: "inherit",
          resize: "vertical",
          marginBottom: 8,
          boxSizing: "border-box",
        }}
      />
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <div
          style={{
            display: "flex",
            flex: 1,
            border: `1px solid ${COLORS.grayBorder}`,
            borderRadius: 6,
            overflow: "hidden",
          }}
        >
          {(["support", "challenge"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setLinkType(s)}
              style={{
                flex: 1,
                padding: "5px 8px",
                fontSize: 11,
                fontWeight: 600,
                border: "none",
                borderRight:
                  s === "support" ? `1px solid ${COLORS.grayBorder}` : "none",
                background:
                  linkType === s
                    ? s === "support"
                      ? COLORS.greenLight
                      : COLORS.redLight
                    : COLORS.white,
                color:
                  linkType === s
                    ? s === "support"
                      ? COLORS.green
                      : COLORS.red
                    : COLORS.gray,
                cursor: "pointer",
              }}
            >
              {s === "support" ? "Supports" : "Challenges"}
            </button>
          ))}
        </div>
        <button
          className="btn btn-primary"
          onClick={handleSubmit}
          disabled={!text.trim() || claimLoading || linkLoading}
          style={{ padding: "6px 16px", fontSize: 12 }}
        >
          {claimLoading || linkLoading ? "Creating…" : "Submit"}
        </button>
      </div>
      {status && (
        <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 6 }}>
          {status}
        </div>
      )}
      {error && (
        <div style={{ fontSize: 12, color: COLORS.red, marginTop: 6 }}>
          {error}
        </div>
      )}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────

export default function TopicExplorer({
  rows,
  title,
}: {
  rows: TopicRow[];
  title?: string;
}) {
  // Flatten all claims
  const allClaims: ClaimData[] = [];
  for (const row of rows) {
    if (row.incumbent) allClaims.push(row.incumbent);
    for (const ch of row.challengers) allClaims.push(ch);
  }

  const { isConnected, address: userAddress } = useAccount();
  const {
    createClaim,
    loading: createLoading,
    error: createError,
    needsApproval,
    approveVSP,
  } = useCreateClaim();

  const [focusIndex, setFocusIndex] = useState(0);
  const [focusClaim, setFocusClaim] = useState<ClaimData>(
    allClaims[0] || { text: "" },
  );
  const [breadcrumbs, setBreadcrumbs] = useState<{ text: string }[]>([
    { text: allClaims[0]?.text || "" },
  ]);

  const [incomingEdges, setIncomingEdges] = useState<EdgeData[]>([]);
  const [outgoingEdges, setOutgoingEdges] = useState<EdgeData[]>([]);
  const [edgesLoading, setEdgesLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"incoming" | "outgoing">(
    "incoming",
  );

  const fetchFocusData = useCallback(
    async (claim: ClaimData) => {
      try {
        const url = `${API_BASE}/claim-status/${encodeURIComponent(claim.text)}${
          userAddress ? `?user=${userAddress}` : ""
        }`;
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();

        const updated: ClaimData = { ...claim };
        if (data.on_chain?.post_id != null) {
          updated.post_id = data.on_chain.post_id;
          updated.on_chain = data.on_chain;
          updated.stake_support = data.stake_support ?? 0;
          updated.stake_challenge = data.stake_challenge ?? 0;
          updated.verity_score = data.verity_score ?? 0;
          updated.user_support = data.user_support ?? 0;
          updated.user_challenge = data.user_challenge ?? 0;
        }
        setFocusClaim(updated);

        const postId = data.on_chain?.post_id;
        if (postId != null) {
          setEdgesLoading(true);
          try {
            const edgeRes = await fetch(`${API_BASE}/claims/${postId}/edges`);
            if (edgeRes.ok) {
              const edgeData = await edgeRes.json();
              setIncomingEdges(edgeData.incoming || []);
              setOutgoingEdges(edgeData.outgoing || []);
            } else {
              setIncomingEdges([]);
              setOutgoingEdges([]);
            }
          } catch {
            setIncomingEdges([]);
            setOutgoingEdges([]);
          }
          setEdgesLoading(false);
        } else {
          setIncomingEdges([]);
          setOutgoingEdges([]);
        }
      } catch (e) {
        console.warn("fetch focus data failed:", e);
      }
    },
    [userAddress],
  );

  const navigateTo = useCallback(
    (claim: ClaimData, fromBreadcrumb = false, bcIndex?: number) => {
      setFocusClaim(claim);
      setIncomingEdges([]);
      setOutgoingEdges([]);
      setActiveTab("incoming");
      fetchFocusData(claim);
      if (fromBreadcrumb && bcIndex != null) {
        setBreadcrumbs((prev) => prev.slice(0, bcIndex + 1));
      } else {
        setBreadcrumbs((prev) => [...prev, { text: claim.text }]);
      }
    },
    [fetchFocusData],
  );

  const navigateToEdge = useCallback(
    async (edge: EdgeData) => {
      try {
        const res = await fetch(
          `${API_BASE}/claims/${edge.claim_post_id}/summary`,
        );
        if (res.ok) {
          const data = await res.json();
          navigateTo({
            text: data.text || `Claim #${edge.claim_post_id}`,
            post_id: edge.claim_post_id,
            on_chain: { post_id: edge.claim_post_id },
            stake_support: data.stake_support ?? 0,
            stake_challenge: data.stake_challenge ?? 0,
            verity_score: data.verity_score ?? 0,
          });
          return;
        }
      } catch {}
      navigateTo({
        text: edge.claim_text || `Claim #${edge.claim_post_id}`,
        post_id: edge.claim_post_id,
        on_chain: { post_id: edge.claim_post_id },
        verity_score: edge.claim_vs ?? 0,
      });
    },
    [navigateTo],
  );

  useEffect(() => {
    if (allClaims.length > 0) fetchFocusData(allClaims[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSeedClick = (claim: ClaimData, idx: number) => {
    setFocusIndex(idx);
    setBreadcrumbs([{ text: claim.text }]);
    setFocusClaim(claim);
    setIncomingEdges([]);
    setOutgoingEdges([]);
    fetchFocusData(claim);
  };

  const handleCreateOnChain = async () => {
    if (needsApproval) {
      await approveVSP();
    }
    const result = await createClaim(focusClaim.text);
    if (result) {
      // Poll for chain indexing
      for (let i = 0; i < 5; i++) {
        await new Promise((r) => setTimeout(r, 2500));
        await fetchFocusData(focusClaim);
      }
    }
  };

  const focusVS = clean(focusClaim.verity_score);
  const focusOnChain = isOnChain(focusClaim);
  const focusPostId = getPostId(focusClaim);
  const activeEdges = activeTab === "incoming" ? incomingEdges : outgoingEdges;

  if (allClaims.length === 0) {
    return <div className="card muted">No claims found for this topic.</div>;
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      {/* Title */}
      {title && (
        <h2
          style={{
            fontSize: 22,
            fontWeight: 700,
            margin: "0 0 16px",
            color: COLORS.text,
          }}
        >
          {title}
        </h2>
      )}

      {/* ── Seed Claims Grid ── */}
      <div style={S.seedStrip}>
        {allClaims.map((claim, i) => {
          const vs = clean(claim.verity_score);
          const onC = isOnChain(claim);
          return (
            <div
              key={i}
              onClick={() => handleSeedClick(claim, i)}
              style={S.seedChip(i === focusIndex, vs, onC)}
              onMouseEnter={(e) => {
                if (i !== focusIndex)
                  (e.currentTarget as HTMLDivElement).style.borderColor =
                    "#aaa";
              }}
              onMouseLeave={(e) => {
                if (i !== focusIndex)
                  (e.currentTarget as HTMLDivElement).style.borderColor =
                    COLORS.grayBorder;
              }}
            >
              {/* On-chain dot */}
              <div style={S.chainDot(onC)} />
              {/* VS badge */}
              <span style={S.vsBadge(vs, onC)}>{formatVS(vs, onC)}</span>
              {/* Text */}
              <span style={S.seedText}>{claim.text}</span>
            </div>
          );
        })}
      </div>

      {/* ── Breadcrumbs ── */}
      <Breadcrumbs
        trail={breadcrumbs}
        onNavigate={(idx) => {
          const bc = breadcrumbs[idx];
          const found = allClaims.find((c) => c.text === bc.text);
          if (found) navigateTo(found, true, idx);
        }}
      />

      {/* ── Focus Claim Card ── */}
      <div style={S.focusCard(focusVS)}>
        <div
          style={{
            ...S.focusText,
            background: vsBackground(focusVS),
          }}
        >
          {focusClaim.text}
        </div>

        {/* Meta row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginBottom: 14,
            flexWrap: "wrap",
          }}
        >
          {/* VS */}
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span
              style={{
                fontSize: 11,
                color: COLORS.textMuted,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                fontWeight: 600,
              }}
            >
              Verity Score
            </span>
            <span
              style={{
                fontSize: 22,
                fontWeight: 700,
                color: vsAccent(focusVS),
                letterSpacing: "-0.02em",
              }}
            >
              {formatVS(focusVS, focusOnChain)}
            </span>
          </div>

          {/* Chain status */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: 11,
              color: focusOnChain ? COLORS.chainBadge : COLORS.textMuted,
              fontWeight: 600,
            }}
          >
            <div style={S.chainDot(focusOnChain)} />
            {focusOnChain ? "On-chain" : "Off-chain"}
          </div>

          {/* Author */}
          {focusClaim.author && (
            <span style={{ fontSize: 12, color: COLORS.textMuted }}>
              by {focusClaim.author}
            </span>
          )}
        </div>

        {/* Create button */}
        {!focusOnChain && isConnected && (
          <div style={{ marginBottom: 8 }}>
            <button
              className="btn btn-primary"
              onClick={handleCreateOnChain}
              disabled={createLoading}
            >
              {createLoading
                ? "Creating…"
                : needsApproval
                  ? "Approve VSP & Create On-Chain"
                  : "Create On-Chain"}
            </button>
            {createError && (
              <div style={{ fontSize: 12, color: COLORS.red, marginTop: 6 }}>
                {createError}
              </div>
            )}
          </div>
        )}
        {!focusOnChain && !isConnected && (
          <div
            style={{ fontSize: 13, color: COLORS.textMuted, marginBottom: 8 }}
          >
            Connect wallet to create on-chain
          </div>
        )}

        {/* Staking */}
        {focusOnChain && focusPostId != null && (
          <StakePanel
            postId={focusPostId}
            label="claim"
            supportTotal={clean(focusClaim.stake_support)}
            challengeTotal={clean(focusClaim.stake_challenge)}
            userSupport={clean(focusClaim.user_support)}
            userChallenge={clean(focusClaim.user_challenge)}
            onStaked={() => fetchFocusData(focusClaim)}
          />
        )}
      </div>

      {/* ── Evidence Panel ── */}
      <div style={S.evidencePanel}>
        {/* Tabs */}
        <div style={S.evidenceTabs}>
          <button
            style={S.evidenceTab(activeTab === "incoming")}
            onClick={() => setActiveTab("incoming")}
          >
            Evidence for
            {incomingEdges.length > 0 && (
              <span
                style={{
                  marginLeft: 6,
                  padding: "1px 7px",
                  borderRadius: 10,
                  fontSize: 10,
                  fontWeight: 700,
                  background:
                    activeTab === "incoming" ? COLORS.text : COLORS.grayLight,
                  color: activeTab === "incoming" ? COLORS.white : COLORS.gray,
                }}
              >
                {incomingEdges.length}
              </span>
            )}
          </button>
          <button
            style={S.evidenceTab(activeTab === "outgoing")}
            onClick={() => setActiveTab("outgoing")}
          >
            Used as evidence in
            {outgoingEdges.length > 0 && (
              <span
                style={{
                  marginLeft: 6,
                  padding: "1px 7px",
                  borderRadius: 10,
                  fontSize: 10,
                  fontWeight: 700,
                  background:
                    activeTab === "outgoing" ? COLORS.text : COLORS.grayLight,
                  color: activeTab === "outgoing" ? COLORS.white : COLORS.gray,
                }}
              >
                {outgoingEdges.length}
              </span>
            )}
          </button>
        </div>

        {/* Edge list */}
        <div style={{ maxHeight: 380, overflowY: "auto" }}>
          {edgesLoading && <div style={S.evidenceEmpty}>Loading evidence…</div>}
          {!edgesLoading && activeEdges.length === 0 && (
            <div style={S.evidenceEmpty}>
              {focusPostId
                ? `No ${activeTab === "incoming" ? "evidence linked to" : "claims citing"} this claim yet.`
                : "Create this claim on-chain to see evidence links."}
            </div>
          )}
          {!edgesLoading &&
            activeEdges.map((edge, i) => {
              const evs = edge.claim_vs ?? 0;
              const linkStake =
                (edge.link_support ?? 0) + (edge.link_challenge ?? 0);
              return (
                <div
                  key={`${edge.link_post_id}-${i}`}
                  style={S.evidenceRow}
                  onClick={() => navigateToEdge(edge)}
                  onMouseEnter={(e) =>
                    ((e.currentTarget as HTMLDivElement).style.background =
                      "#f9fafb")
                  }
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLDivElement).style.background =
                      "transparent")
                  }
                >
                  {/* Link type icon */}
                  <div
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 6,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      flexShrink: 0,
                      background: edge.is_challenge
                        ? COLORS.redLight
                        : COLORS.greenLight,
                      color: edge.is_challenge ? COLORS.red : COLORS.green,
                    }}
                  >
                    {edge.is_challenge ? "⚔" : "✦"}
                  </div>
                  {/* Body */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        lineHeight: 1.4,
                        color: COLORS.text,
                      }}
                    >
                      {edge.claim_text ?? `Claim #${edge.claim_post_id}`}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: 10,
                        marginTop: 3,
                        fontSize: 11,
                      }}
                    >
                      <span style={{ color: vsAccent(evs), fontWeight: 600 }}>
                        VS {formatVS(evs, true)}
                      </span>
                      {linkStake > 0 && (
                        <span style={{ color: COLORS.textMuted }}>
                          Link stake: {linkStake.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Arrow */}
                  <span
                    style={{
                      alignSelf: "center",
                      fontSize: 16,
                      color: COLORS.textMuted,
                      flexShrink: 0,
                    }}
                  >
                    ›
                  </span>
                </div>
              );
            })}
        </div>

        {/* Link creation */}
        {focusPostId != null && (
          <LinkCreationPanel
            focusPostId={focusPostId}
            focusText={focusClaim.text}
            onCreated={() => fetchFocusData(focusClaim)}
          />
        )}
      </div>
    </div>
  );
}
