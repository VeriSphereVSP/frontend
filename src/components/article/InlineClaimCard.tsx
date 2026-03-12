// frontend/src/components/article/InlineClaimCard.tsx
import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useAccount } from "wagmi";
import { useCreateClaim } from "@verisphere/protocol";
import { useCreateLink } from "@verisphere/protocol";
import { useStake } from "@verisphere/protocol";
import { C, n, fmt, vc } from "./theme";
import type { Sentence, Edge } from "./types";
import B from "./MiniButton";
import StakeInput from "./StakeInput";

const API = import.meta.env.VITE_API_BASE || "/api";

/* ── Link stake widget — matches claim card layout ── */
function LinkStakeWidget({
  linkPostId,
  linkVS,
  onDone,
}: {
  linkPostId: number;
  linkVS?: number;
  onDone: () => void;
}) {
  const { stake, withdraw, loading } = useStake();
  const { isConnected, address } = useAccount();
  const [amt, setAmt] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [userSup, setUserSup] = useState(0);
  const [userChal, setUserChal] = useState(0);
  const vs = n(linkVS ?? 0);

  // Fetch user position on this link
  useEffect(() => {
    if (!address || !linkPostId) return;
    fetch(`${API}/claims/${linkPostId}/user-stake?user=${address}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setUserSup(n(d.user_support));
          setUserChal(n(d.user_challenge));
        }
      })
      .catch(() => {});
  }, [linkPostId, address]);

  const go = async () => {
    const val = parseFloat(amt);
    if (!val) return;
    setErr(null);
    try {
      const absVal = Math.abs(val);
      if (val > 0) {
        if (userChal > 0) {
          const tw = Math.min(userChal, absVal);
          await withdraw(linkPostId, "challenge", tw);
          if (absVal - tw > 0.001) await stake(linkPostId, "support", absVal - tw);
        } else {
          await stake(linkPostId, "support", absVal);
        }
      } else {
        if (userSup > 0) {
          const tw = Math.min(userSup, absVal);
          await withdraw(linkPostId, "support", tw);
          if (absVal - tw > 0.001) await stake(linkPostId, "challenge", absVal - tw);
        } else {
          await stake(linkPostId, "challenge", absVal);
        }
      }
      setAmt("");
      // Refresh user position
      setTimeout(() => {
        if (address) {
          fetch(`${API}/claims/${linkPostId}/user-stake?user=${address}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
              if (d) { setUserSup(n(d.user_support)); setUserChal(n(d.user_challenge)); }
            }).catch(() => {});
        }
      }, 3000);
      onDone();
    } catch (e: any) {
      setErr(e?.shortMessage || e?.message || String(e));
    }
  };

  const posLabel = userSup > 0.001
    ? `${userSup.toFixed(1)} support`
    : userChal > 0.001
      ? `${userChal.toFixed(1)} challenge`
      : "none";
  const posColor = userSup > 0.001 ? C.green : userChal > 0.001 ? C.red : C.muted;
  const val = parseFloat(amt);
  const isPos = !isNaN(val) && val > 0;
  const isNeg = !isNaN(val) && val < 0;

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        marginTop: 4,
        padding: "6px 8px",
        background: "rgba(59,130,246,0.04)",
        borderRadius: 6,
        border: `1px solid rgba(59,130,246,0.12)`,
      }}
    >
      {/* Line 1: Stake this link + input */}
      <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap", marginBottom: 3 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: C.text }}>
          Stake this link:
        </span>
        <StakeInput value={amt} onChange={setAmt} onSubmit={go} />
        <B onClick={go} dis={loading || !amt}>
          {loading ? "…" : "Go"}
        </B>
        <span style={{ fontSize: 10 }}>
          <span style={{ color: isPos ? C.green : C.muted, fontWeight: isPos ? 700 : 400 }}>
            + support
          </span>
          <span style={{ color: C.muted }}> / </span>
          <span style={{ color: isNeg ? C.red : C.muted, fontWeight: isNeg ? 700 : 400 }}>
            − challenge
          </span>
        </span>
      </div>
      {/* Line 2: Position + link metadata */}
      <div style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 10, color: C.muted, flexWrap: "wrap" }}>
        {isConnected && (
          <span>
            Your position: <span style={{ color: posColor, fontWeight: 600 }}>{posLabel}</span>
          </span>
        )}
        <span style={{ color: C.muted }}>·</span>
        <span>Link#{linkPostId}</span>
        <span style={{ color: vs >= 0 ? C.green : C.red }}>{vs >= 0 ? "▲" : "▼"}</span>
        <span style={{ fontWeight: 600, color: vc(vs) }}>VS {fmt(vs)}</span>
      </div>
      {err && <div style={{ fontSize: 9, color: C.red, marginTop: 2 }}>{err.slice(0, 60)}</div>}
    </div>
  );
}

/* ── LinkPanel: one direction (incoming or outgoing) ── */
function LinkPanel({
  direction,
  edges,
  pid,
  thisText,
  allSentences,
  isConnected,
  onCreateLink,
  linking,
  onRefresh,
}: {
  direction: "incoming" | "outgoing";
  edges: Edge[];
  pid: number;
  thisText: string;
  allSentences?: Sentence[];
  isConnected: boolean;
  onCreateLink: (
    fromId: number,
    toId: number,
    isChallenge: boolean,
  ) => Promise<string | null>;
  linking: boolean;
  onRefresh: () => void;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState<Sentence | null>(null);
  const [linkType, setLinkType] = useState<"support" | "challenge">("support");
  const [stakingLinkId, setStakingLinkId] = useState<number | null>(null);
  const [linkInitStake, setLinkInitStake] = useState("1");
  const { stake: stakeOnLink } = useStake();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const cands = useMemo(
    () =>
      (allSentences || []).filter(
        (s) => s.post_id != null && s.post_id !== pid,
      ),
    [allSentences, pid],
  );
  const filtered = useMemo(() => {
    if (!search.trim()) return cands;
    const q = search.toLowerCase();
    return cands.filter((s) => s.text.toLowerCase().includes(q));
  }, [cands, search]);

  const doLink = async () => {
    if (pick?.post_id == null) return;
    const isDup = edges.some(
      (e) =>
        e.claim_post_id === pick!.post_id! &&
        e.is_challenge === (linkType === "challenge"),
    );
    if (isDup) {
      setPick(null);
      setSearch("");
      return;
    }
    let txHash: string | null = null;
    if (direction === "outgoing") {
      txHash = await onCreateLink(pid, pick.post_id, linkType === "challenge");
    } else {
      txHash = await onCreateLink(pick.post_id, pid, linkType === "challenge");
    }
    // Stake on the new link if creation succeeded
    // The link post_id is returned by the relay — we need to wait for the edges refresh
    // to find it. For now, use a small delay then stake.
    const amt = parseFloat(linkInitStake);
    if (amt > 0 && txHash) {
      setTimeout(async () => {
        try {
          // Re-fetch edges to find the new link's post_id
          const dir = direction === "outgoing" ? "outgoing" : "incoming";
          const res = await fetch(`${API}/claims/${pid}/edges?direction=${dir}`).then(r => r.json());
          const newEdges = res[dir] || res.edges || [];
          const newLink = newEdges.find((e: any) =>
            e.claim_post_id === pick!.post_id && e.is_challenge === (linkType === "challenge")
          );
          if (newLink?.link_post_id) {
            await stakeOnLink(newLink.link_post_id, "support", amt);
            window.dispatchEvent(new Event("verisphere:data-changed"));
          }
        } catch (e) {
          console.warn("Initial link stake failed:", e);
        }
        onRefresh();
      }, 3000);
    }
    setPick(null);
    setSearch("");
  };

  const title =
    direction === "incoming"
      ? "Incoming — evidence for/against this claim"
      : "Outgoing — this claim is evidence for/against";

  return (
    <div style={{ flex: "1 1 0", minWidth: 140 }} ref={ref}>
      <div
        style={{
          fontSize: 8,
          color: C.muted,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: ".03em",
          marginBottom: 2,
        }}
      >
        {title}
      </div>
      <div
        style={{
          maxHeight: 90,
          overflowY: "auto",
          border: `1px solid ${C.gl}`,
          borderRadius: 3,
          padding: "2px 3px",
          marginBottom: 3,
        }}
      >
        {edges.length === 0 ? (
          <div style={{ fontSize: 9, color: C.muted, fontStyle: "italic" }}>
            None
          </div>
        ) : (
          edges.map((e, i) => {
            const isC = e.is_challenge;
            const isStaking = stakingLinkId === e.link_post_id;
            return (
              <div key={i}>
                <div
                  onClick={() =>
                    setStakingLinkId(isStaking ? null : e.link_post_id)
                  }
                  style={{
                    fontSize: 10,
                    padding: "1px 0",
                    display: "flex",
                    gap: 3,
                    alignItems: "baseline",
                    cursor: "pointer",
                    borderRadius: 2,
                    background: isStaking
                      ? "rgba(59,130,246,0.06)"
                      : "transparent",
                  }}
                  title="Click to stake this link"
                >
                  <span style={{ color: isC ? C.red : C.green, fontSize: 10, fontWeight: 700 }}>
                    {isC ? "✗" : "✓"}
                    {direction === "outgoing" ? " →" : ""}
                  </span>
                  <span
                    style={{
                      flex: 1,
                      fontWeight: 600,
                      fontSize: 11,
                      color: isC ? C.red : C.text,
                    }}
                  >
                    {(e.claim_text || `#${e.claim_post_id}`).slice(0, 30)}
                    {(e.claim_text || "").length > 30 ? "…" : ""}
                  </span>
                  <span
                    style={{
                      color: vc(e.claim_vs ?? 0),
                      fontSize: 8,
                      fontWeight: 600,
                    }}
                  >
                    {fmt(e.claim_vs ?? 0)}
                  </span>
                </div>
                {isStaking && isConnected && (
                  <LinkStakeWidget
                    linkPostId={e.link_post_id}
                    linkVS={e.claim_vs}
                    onDone={() => {
                      setStakingLinkId(null);
                      onRefresh();
                    }}
                  />
                )}
              </div>
            );
          })
        )}
      </div>
      {isConnected && (
        <>
          <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
            <div style={{ position: "relative", flex: 1, minWidth: 50 }}>
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setOpen(true);
                  setPick(null);
                }}
                onFocus={() => setOpen(true)}
                placeholder="Search claim…"
                style={{
                  width: "100%",
                  padding: "2px 4px",
                  borderRadius: 3,
                  border: `1px solid ${C.gb}`,
                  fontSize: 9,
                  boxSizing: "border-box",
                }}
              />
              {open && filtered.length > 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: "100%",
                    left: 0,
                    right: 0,
                    zIndex: 50,
                    background: C.white,
                    border: `1px solid ${C.gb}`,
                    borderRadius: "0 0 4px 4px",
                    maxHeight: 80,
                    overflowY: "auto",
                    boxShadow: "0 3px 8px rgba(0,0,0,.06)",
                  }}
                >
                  {filtered.slice(0, 6).map((s) => (
                    <div
                      key={s.sentence_id}
                      onClick={() => {
                        setPick(s);
                        setSearch(s.text.slice(0, 30));
                        setOpen(false);
                      }}
                      style={{
                        padding: "2px 4px",
                        cursor: "pointer",
                        fontSize: 9,
                        borderBottom: `1px solid ${C.gl}`,
                      }}
                    >
                      {s.text.slice(0, 40)}
                      {s.text.length > 40 ? "…" : ""}
                      <span
                        style={{
                          color: vc(n(s.verity_score)),
                          fontWeight: 600,
                          fontSize: 8,
                          marginLeft: 2,
                        }}
                      >
                        #{s.post_id}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <span
              onClick={() =>
                setLinkType(linkType === "support" ? "challenge" : "support")
              }
              title={
                linkType === "support"
                  ? "Support (click for challenge)"
                  : "Challenge (click for support)"
              }
              style={{
                fontSize: 10,
                fontWeight: 600,
                cursor: "pointer",
                padding: "1px 5px",
                borderRadius: 3,
                background: linkType === "support" ? C.green : C.red,
                color: C.white,
                userSelect: "none",
              }}
            >
              {linkType === "support" ? "✦" : "⚔"}
            </span>
            <StakeInput value={linkInitStake} onChange={setLinkInitStake} onSubmit={doLink} />
            <B onClick={doLink} dis={linking || !pick}>
              {linking ? "…" : "Link & stake"}
            </B>
          </div>
          {pick && (
            <div
              style={{
                fontSize: 9,
                color: C.gray,
                marginTop: 2,
                fontStyle: "italic",
                lineHeight: 1.3,
              }}
            >
              {(() => {
                const picked = `"${pick.text.slice(0, 25)}${pick.text.length > 25 ? "…" : ""}"`;
                const thisClaim = `"${thisText.slice(0, 25)}${thisText.length > 25 ? "…" : ""}"`;
                const verb = linkType === "support" ? "supports" : "challenges";
                const clr = linkType === "support" ? C.green : C.red;
                if (direction === "outgoing")
                  return (
                    <>
                      {thisClaim} <b style={{ color: clr }}>{verb}</b> {picked}
                    </>
                  );
                return (
                  <>
                    {picked} <b style={{ color: clr }}>{verb}</b> {thisClaim}
                  </>
                );
              })()}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════
   Main InlineClaimCard
   ════════════════════════════════════════════════ */
export default function InlineClaimCard({
  postId,
  text,
  stakeSupport,
  stakeChallenge,
  verityScore,
  sentenceId,
  allSentences,
  onRefresh,
  onClose,
  postType,
}: {
  postId: number | null;
  text: string;
  stakeSupport: number;
  stakeChallenge: number;
  verityScore: number;
  postType?: "claim" | "link";
  sentenceId?: number;
  allSentences?: Sentence[];
  onRefresh: () => void;
  onClose?: () => void;
}) {
  const { isConnected, address } = useAccount();
  const {
    createClaim,
    loading: txing,
    needsApproval,
    approveVSP,
    error: claimError,
  } = useCreateClaim();
  const { createLink, loading: linking } = useCreateLink();
  const {
    stake,
    withdraw,
    loading: staking,
    error: stakeError,
    needsApproval: stakeNeedsApproval,
    approveVSP: stakeApproveVSP,
  } = useStake();
  const [edges, setEdges] = useState<Edge[]>([]);
  const [eLoading, setELoading] = useState(false);
  const [amt, setAmt] = useState("");
  const [goError, setGoError] = useState<string | null>(null);
  const [userSup, setUserSup] = useState(0);
  const [userChal, setUserChal] = useState(0);
  const [initStake, setInitStake] = useState("1");
  const [createPhase, setCreatePhase] = useState<"idle" | "creating" | "staking">("idle");
  const vs = n(verityScore);
  const [resolvedPid, setResolvedPid] = useState<number | null>(postId);
  const [checking, setChecking] = useState(false);
  const pid = resolvedPid;

  /* ── on-chain duplicate check ── */
  useEffect(() => {
    if (postId != null) {
      setResolvedPid(postId);
      return;
    }
    if (!text) return;
    setChecking(true);
    fetch(`${API}/claims/check-onchain?text=${encodeURIComponent(text)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.exists && d.post_id != null) {
          setResolvedPid(d.post_id);
          if (sentenceId) {
            fetch(`${API}/article/sentence/${sentenceId}/link_post`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ post_id: d.post_id }),
            }).then(() => onRefresh());
          }
        }
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, [postId, text, sentenceId]);

  /* ── fetch user position ── */
  useEffect(() => {
    if (pid == null || !address) return;
    fetch(`${API}/claims/${pid}/user-stake?user=${address}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setUserSup(n(d.user_support));
          setUserChal(n(d.user_challenge));
        }
      })
      .catch(() => {});
  }, [pid, address]);

  /* ── fetch edges ── */
  const refreshEdges = useCallback(async () => {
    if (pid == null) {
      setEdges([]);
      return;
    }
    setELoading(true);
    try {
      const [i, o] = await Promise.all([
        fetch(`${API}/claims/${pid}/edges?direction=incoming`).then((r) =>
          r.json(),
        ),
        fetch(`${API}/claims/${pid}/edges?direction=outgoing`).then((r) =>
          r.json(),
        ),
      ]);
      setEdges([
        ...(i.incoming || i.edges || []).map((e: any) => ({
          ...e,
          _dir: "incoming",
        })),
        ...(o.outgoing || o.edges || []).map((e: any) => ({
          ...e,
          _dir: "outgoing",
        })),
      ]);
    } catch {
      setEdges([]);
    }
    setELoading(false);
  }, [pid]);
  useEffect(() => {
    refreshEdges();
  }, [refreshEdges]);

  const incomingEdges = edges
    .filter((e) => e._dir === "incoming")
    .sort((a, b) => (b.claim_vs ?? 0) - (a.claim_vs ?? 0));
  const outgoingEdges = edges
    .filter((e) => e._dir === "outgoing")
    .sort((a, b) => (b.claim_vs ?? 0) - (a.claim_vs ?? 0));

  /* ── signed stake logic ── */
  const doGo = async () => {
    if (pid == null) return;
    const val = parseFloat(amt);
    if (!val || val === 0) return;
    const absVal = Math.abs(val);
    setGoError(null);
    try {
      if (val > 0) {
        if (userChal > 0) {
          const tw = Math.min(userChal, absVal);
          await withdraw(pid, "challenge", tw);
          if (absVal - tw > 0.001) await stake(pid, "support", absVal - tw);
        } else {
          await stake(pid, "support", absVal);
        }
      } else {
        if (userSup > 0) {
          const tw = Math.min(userSup, absVal);
          await withdraw(pid, "support", tw);
          if (absVal - tw > 0.001) await stake(pid, "challenge", absVal - tw);
        } else {
          await stake(pid, "challenge", absVal);
        }
      }
    } catch (e: any) {
      setGoError(e?.shortMessage || e?.message || String(e));
    }
    setAmt("");
    setTimeout(onRefresh, 2000);
    if (address && pid) {
      setTimeout(() => {
        fetch(`${API}/claims/${pid}/user-stake?user=${address}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (d) {
              setUserSup(n(d.user_support));
              setUserChal(n(d.user_challenge));
            }
          })
          .catch(() => {});
      }, 3000);
    }
  };

  /* ── register on chain ── */
  const registerOnChain = async () => {
    if (!sentenceId) return;
    setCreatePhase("creating");
    setGoError(null);
    try {
      const result = await createClaim(text);
      let newPid = result?.post_id ?? null;
      if (newPid == null || newPid < 0) {
        const check = await fetch(
          `${API}/claims/check-onchain?text=${encodeURIComponent(text)}`,
        ).then((r) => r.json());
        if (check?.exists && check.post_id != null) newPid = check.post_id;
      }
      if (newPid != null && newPid > 0) {
        setResolvedPid(newPid);
        await fetch(`${API}/article/sentence/${sentenceId}/link_post`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ post_id: newPid }),
        });
        try {
          await fetch(`${API}/claims/record`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text, post_id: newPid }),
          });
        } catch {}
        // Initial stake
        const amt = parseFloat(initStake);
        if (amt > 0) {
          setCreatePhase("staking");
          try {
            await stake(newPid, "support", amt);
          } catch (e: any) {
            console.warn("Initial stake failed (claim created):", e);
          }
        }
        window.dispatchEvent(new Event("verisphere:data-changed"));
        onRefresh();
      } else {
        setGoError("Claim creation failed");
        setTimeout(onRefresh, 3000);
      }
    } catch (e: any) {
      setGoError(e?.message || "Failed to create claim");
    } finally {
      setCreatePhase("idle");
    }
  };

  const handleCreateLink = async (
    fromId: number,
    toId: number,
    isChallenge: boolean,
  ): Promise<string | null> => {
    const txHash = await createLink(fromId, toId, isChallenge);
    refreshEdges();
    return txHash;
  };

  const posLabel =
    userSup > 0.001
      ? `${userSup.toFixed(1)} support`
      : userChal > 0.001
        ? `${userChal.toFixed(1)} challenge`
        : "none";
  const posColor =
    userSup > 0.001 ? C.green : userChal > 0.001 ? C.red : C.muted;

  /* ════════════════════ render ════════════════════ */
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        margin: "4px 0 8px",
        padding: "8px 10px",
        background: "#fafbfc",
        borderRadius: 8,
        border: `1px solid ${C.gb}`,
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      }}
    >
      {/* ── Top section: staking (prominent) + close button ── */}
      <div style={{ marginBottom: 5 }}>
        {pid != null ? (
          <>
            {/* Line 1: Staking — prominent, directly below the claim text */}
            {isConnected &&
              (() => {
                if (stakeNeedsApproval)
                  return (
                    <div
                      style={{
                        display: "flex",
                        gap: 6,
                        alignItems: "center",
                        marginBottom: 3,
                      }}
                    >
                      <span
                        style={{ fontSize: 12, fontWeight: 700, color: C.text }}
                      >
                        {(postType === "link") ? "Stake this link" : "Stake this claim"}
                      </span>
                      <span style={{ color: C.muted }}>·</span>
                      <span style={{ fontSize: 10, color: C.gray }}>
                        VSP approval needed
                      </span>
                      <B onClick={stakeApproveVSP} dis={staking}>
                        {staking ? "…" : "Approve"}
                      </B>
                      {onClose && (
                        <>
                          <span style={{ flex: 1 }} />
                          <span
                            onClick={onClose}
                            style={{
                              cursor: "pointer",
                              fontSize: 13,
                              color: C.muted,
                              fontWeight: 700,
                              lineHeight: 1,
                              padding: "0 2px",
                            }}
                            title="Close"
                          >
                            ✕
                          </span>
                        </>
                      )}
                    </div>
                  );
                const val = parseFloat(amt);
                const isPos = !isNaN(val) && val > 0;
                const isNeg = !isNaN(val) && val < 0;
                return (
                  <div
                    style={{
                      display: "flex",
                      gap: 5,
                      alignItems: "center",
                      flexWrap: "wrap",
                      marginBottom: 3,
                    }}
                  >
                    <span
                      style={{ fontSize: 12, fontWeight: 700, color: C.text }}
                    >
                      {postType === "link" ? "Stake this link:" : "Stake this claim:"}
                    </span>
                    <StakeInput value={amt} onChange={setAmt} onSubmit={doGo} />
                    <B onClick={doGo} dis={staking || !amt}>
                      {staking ? "…" : "Go"}
                    </B>
                    <span style={{ fontSize: 10 }}>
                      <span
                        style={{
                          color: isPos ? C.green : C.muted,
                          fontWeight: isPos ? 700 : 400,
                        }}
                      >
                        + support
                      </span>
                      <span style={{ color: C.muted }}> / </span>
                      <span
                        style={{
                          color: isNeg ? C.red : C.muted,
                          fontWeight: isNeg ? 700 : 400,
                        }}
                      >
                        − challenge
                      </span>
                    </span>
                    {onClose && (
                      <>
                        <span style={{ flex: 1 }} />
                        <span
                          onClick={onClose}
                          style={{
                            cursor: "pointer",
                            fontSize: 13,
                            color: C.muted,
                            fontWeight: 700,
                            lineHeight: 1,
                            padding: "0 2px",
                          }}
                          title="Close"
                        >
                          ✕
                        </span>
                      </>
                    )}
                  </div>
                );
              })()}

            {/* Line 2: Position + claim metadata */}
            <div
              style={{
                display: "flex",
                gap: 6,
                alignItems: "center",
                fontSize: 10,
                color: C.muted,
                flexWrap: "wrap",
              }}
            >
              {isConnected && (
                <span>
                  Your position:{" "}
                  <span style={{ color: posColor, fontWeight: 600 }}>
                    {posLabel}
                  </span>
                </span>
              )}
              <span style={{ color: C.muted }}>·</span>
              <span>{postType === "link" ? "Link" : "Claim"}#{pid}</span>
              <span style={{ color: vs >= 0 ? C.green : C.red }}>
                {vs >= 0 ? "▲" : "▼"}
              </span>
              <span style={{ fontWeight: 600, color: vc(vs) }}>
                VS {fmt(vs)}
              </span>
              {!isConnected && onClose && (
                <>
                  <span style={{ flex: 1 }} />
                  <span
                    onClick={onClose}
                    style={{
                      cursor: "pointer",
                      fontSize: 13,
                      color: C.muted,
                      fontWeight: 700,
                      lineHeight: 1,
                      padding: "0 2px",
                    }}
                    title="Close"
                  >
                    ✕
                  </span>
                </>
              )}
            </div>
          </>
        ) : (
          <div
            style={{
              display: "flex",
              gap: 6,
              alignItems: "center",
              fontSize: 11,
            }}
          >
            {checking ? (
              <span style={{ color: C.muted, fontStyle: "italic" }}>
                Checking on-chain…
              </span>
            ) : (
              <>
                <span style={{ color: C.muted }}>Not on chain</span>
                {isConnected &&
                  sentenceId &&
                  (needsApproval ? (
                    <B onClick={approveVSP}>Approve VSP</B>
                  ) : (
                    <>
                    <StakeInput value={initStake} onChange={setInitStake} onSubmit={registerOnChain} />
                    <span style={{ fontSize: 9, color: C.muted }}>VSP stake</span>
                    <B onClick={registerOnChain} dis={txing || createPhase !== "idle"}>
                      {createPhase === "creating" ? "Creating…" : createPhase === "staking" ? "Staking…" : "Create & stake (1 VSP fee)"}
                    </B>
                    </>
                  ))}
              </>
            )}
            {onClose && (
              <>
                <span style={{ flex: 1 }} />
                <span
                  onClick={onClose}
                  style={{
                    cursor: "pointer",
                    fontSize: 13,
                    color: C.muted,
                    fontWeight: 700,
                    lineHeight: 1,
                    padding: "0 2px",
                  }}
                  title="Close"
                >
                  ✕
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Error display */}
      {(claimError || stakeError || goError) && (
        <div style={{ fontSize: 9, color: C.red, marginBottom: 4 }}>
          {claimError || stakeError || goError}
        </div>
      )}

      {/* ── Row 2: Incoming (left) | Outgoing (right) ── */}
      {pid != null && postType !== "link" && (
        <div style={{ display: "flex", gap: 8 }}>
          {eLoading ? (
            <span style={{ fontSize: 9, color: C.muted }}>Loading links…</span>
          ) : (
            <>
              <LinkPanel
                direction="incoming"
                edges={incomingEdges}
                pid={pid}
                thisText={text}
                allSentences={allSentences}
                isConnected={isConnected}
                onCreateLink={handleCreateLink}
                linking={linking}
                onRefresh={onRefresh}
              />
              <div
                style={{ width: 1, background: C.gb, alignSelf: "stretch" }}
              />
              <LinkPanel
                direction="outgoing"
                edges={outgoingEdges}
                pid={pid}
                thisText={text}
                allSentences={allSentences}
                isConnected={isConnected}
                onCreateLink={handleCreateLink}
                linking={linking}
                onRefresh={onRefresh}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
