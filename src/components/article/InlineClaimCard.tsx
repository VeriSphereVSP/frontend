// frontend/src/components/article/InlineClaimCard.tsx
import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useAccount } from "wagmi";
import VSBar from "../VSBar";
import { useCreateClaim } from "@verisphere/protocol";
import { useCreateLink } from "@verisphere/protocol";
import { useStake } from "@verisphere/protocol";
import { C, n, fmt, vc } from "./theme";
import type { Sentence, Edge } from "./types";
import B from "./MiniButton";
import { friendlyError, fireToast } from "../../utils/errorMessages";
import { fireTxProgress } from "./TxProgress";
import StakeInput from "./StakeInput";
import StakeControl from "../StakeControl";
import ClaimPickerModal from "./ClaimPickerModal";

const MAX_CLAIM_LENGTH = 500;

const API = import.meta.env.VITE_API_BASE || "/api";

const triggerReindex = async (postId: number, userAddr?: string) => {
  try {
    const params = userAddr ? `?user=${userAddr}` : '';
    await fetch(`${API}/reindex/${postId}${params}`, { method: 'POST' });
  } catch (e) { /* non-fatal */ }
};


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
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        marginTop: 4,
        padding: "4px 8px",
        background: "rgba(59,130,246,0.04)",
        borderRadius: 6,
        border: "1px solid rgba(59,130,246,0.12)",
      }}
    >
      <StakeControl
        postId={linkPostId}
        currentSupport={0}
        currentChallenge={0}
        onDone={onDone}
        compact
        label="Your stake on this link:"
      />
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
  const [showPicker, setShowPicker] = useState(false);
  const [globalResults, setGlobalResults] = useState<Sentence[]>([]);

  // Global claim search as user types
  useEffect(() => {
    if (!search.trim() || search.length < 2) {
      setGlobalResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API}/claims/search?q=${encodeURIComponent(search)}&limit=10`);
        if (res.ok) {
          const data = await res.json();
          setGlobalResults(
            (data.claims || [])
              .filter((c: any) => c.post_id !== pid)
              .map((c: any) => ({
                sentence_id: c.post_id,
                text: c.text,
                post_id: c.post_id,
                verity_score: c.verity_score,
                stake_support: c.stake_support || 0,
                stake_challenge: c.stake_challenge || 0,
                replaced_by: null,
              }))
          );
        }
      } catch {}
    }, 300);
    return () => clearTimeout(timer);
  }, [search, pid]);

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
          const res = await fetch(
            `${API}/claims/${pid}/edges?direction=${dir}`,
          ).then((r) => r.json());
          const newEdges = res[dir] || res.edges || [];
          const newLink = newEdges.find(
            (e: any) =>
              e.claim_post_id === pick!.post_id &&
              e.is_challenge === (linkType === "challenge"),
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
                  <span
                    style={{
                      color: isC ? C.red : C.green,
                      fontSize: 10,
                      fontWeight: 700,
                    }}
                  >
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
                    {e.claim_text || `#${e.claim_post_id}`}
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
              {open && (globalResults.length > 0 || filtered.length > 0) && (
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
              onClick={() => setShowPicker(true)}
              title="Browse all claims"
              style={{
                cursor: "pointer",
                fontSize: 10,
                padding: "1px 4px",
                borderRadius: 3,
                border: `1px solid ${C.gb}`,
                background: C.white,
                color: "#2563eb",
                fontWeight: 700,
              }}
            >
              ⊞
            </span>
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
            <StakeInput
              value={linkInitStake}
              onChange={setLinkInitStake}
              onSubmit={doLink}
            />
            <B onClick={doLink} dis={linking || !pick}>
              {linking ? "…" : "Link & stake"}
            </B>
          </div>

          {showPicker && (
            <ClaimPickerModal
              excludePostId={pid}
              onClose={() => setShowPicker(false)}
              onPick={(claim) => {
                setPick({
                  sentence_id: claim.post_id,
                  text: claim.text,
                  post_id: claim.post_id,
                  verity_score: claim.verity_score,
                  stake_support: claim.stake_support,
                  stake_challenge: claim.stake_challenge,
                  replaced_by: null,
                });
                setSearch(claim.text.slice(0, 35));
                setShowPicker(false);
                setOpen(false);
              }}
            />
          )}
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
  linksOnly,
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
  linksOnly?: boolean;
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
  const [createPhase, setCreatePhase] = useState<
    "idle" | "creating" | "staking"
  >("idle");
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
    const sideName = val > 0 ? "support" : "challenge";
    fireTxProgress({
      action: "start",
      title: "Staking",
      steps: [{ label: `Stake ${absVal} VSP ${sideName}`, status: "active" as const }],
    });
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
      const msg = friendlyError(e);
      setGoError(msg);
      fireToast(msg, "error");
    }
    setAmt("");
    fireToast("Stake updated successfully", "success");
    fireTxProgress({ action: "done" });
    // Immediate refresh
    setTimeout(() => onRefresh(), 1000);
    setTimeout(() => onRefresh(), 5000);
    if (postId) await triggerReindex(postId, address);
    onRefresh();
    window.dispatchEvent(new Event("verisphere:data-changed"));
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
    const stakeVal = parseFloat(initStake);
    const steps = [
      { label: "Create claim on-chain", status: "pending" as const },
      ...(stakeVal !== 0 ? [{ label: `Stake ${Math.abs(stakeVal)} VSP ${stakeVal > 0 ? "support" : "challenge"}`, status: "pending" as const }] : []),
      { label: "Update article", status: "pending" as const },
    ];
    fireTxProgress({ action: "start", title: "Creating Claim", steps });
    // Length check
    if (new TextEncoder().encode(text).length > MAX_CLAIM_LENGTH) {
      setGoError(`Claim too long (${new TextEncoder().encode(text).length} bytes, max ${MAX_CLAIM_LENGTH}).`);
      fireTxProgress({ action: "error", error: "Claim too long" });
      setCreatePhase("idle");
      return;
    }
    fireTxProgress({ action: "step", stepIndex: 0 });
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
        if (amt !== 0) {
          setCreatePhase("staking");
          const side = amt > 0 ? "support" : "challenge";
          const absAmt = Math.abs(amt);
          fireTxProgress({ action: "step", stepIndex: 1 });
          try {
            await stake(newPid, side as "support" | "challenge", absAmt);
          } catch (e: any) {
            console.warn("Initial stake failed (claim created):", e);
          }
        }
        window.dispatchEvent(new Event("verisphere:data-changed"));
        // Step: update article
        const stakeStepOffset = parseFloat(initStake) !== 0 ? 2 : 1;
        fireTxProgress({ action: "step", stepIndex: stakeStepOffset });
        fireToast("Claim created!", "success");
        // Immediate refresh — don't wait for indexer
        setTimeout(() => onRefresh(), 1000);
        setTimeout(() => onRefresh(), 5000);
        fireTxProgress({ action: "done" });
      } else {
        setGoError("Claim creation failed");
        setTimeout(onRefresh, 3000);
      }
    } catch (e: any) {
      const msg = friendlyError(e);
      setGoError(msg);
      fireToast(msg, "error");
      fireTxProgress({ action: "error", error: msg });
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
      {/* ── Top section: staking + close (hidden when linksOnly) ── */}
      {!linksOnly && (
      <div style={{ marginBottom: 5 }}>
        {pid != null ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <StakeControl
              postId={pid}
              currentSupport={userSup}
              currentChallenge={userChal}
              onDone={() => {
                onRefresh();
                if (address && pid) {
                  setTimeout(() => {
                    fetch(`${API}/claims/${pid}/user-stake?user=${address}`)
                      .then((r) => (r.ok ? r.json() : null))
                      .then((d) => {
                        if (d) { setUserSup(n(d.user_support)); setUserChal(n(d.user_challenge)); }
                      }).catch(() => {});
                  }, 2000);
                }
              }}
              compact
            />
            {onClose && (
              <span
                onClick={onClose}
                style={{ cursor: "pointer", fontSize: 13, color: C.muted, fontWeight: 700, marginLeft: "auto" }}
                title="Close"
              >✕</span>
            )}
          </div>
        ) : (
          <div style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 11 }}>
            {checking ? (
              <span style={{ color: C.muted, fontStyle: "italic" }}>Checking on-chain…</span>
            ) : (
              <>
                <span style={{ color: C.muted, fontWeight: 600 }}>Not on chain</span>
                {isConnected && sentenceId && (needsApproval ? (
                  <B onClick={approveVSP}>Approve VSP</B>
                ) : (
                  <>
                    <StakeInput value={initStake} onChange={setInitStake} onSubmit={registerOnChain} />
                    <span style={{ fontSize: 9 }}>
                      {(() => {
                        const v = parseFloat(initStake);
                        if (isNaN(v) || v === 0) return <span style={{ color: C.muted }}>no initial stake</span>;
                        if (v > 0) return <span style={{ color: C.green, fontWeight: 600 }}>VSP support</span>;
                        return <span style={{ color: C.red, fontWeight: 600 }}>VSP challenge</span>;
                      })()}
                    </span>
                    <B onClick={registerOnChain} dis={txing || createPhase !== "idle"}>
                      {createPhase === "creating" ? "Creating…" : createPhase === "staking" ? "Staking…" : (() => {
                        const v = parseFloat(initStake);
                        if (isNaN(v) || v === 0) return "Create only (1 VSP fee)";
                        if (v > 0) return `Create + ${Math.abs(v)} support`;
                        return `Create + ${Math.abs(v)} challenge`;
                      })()}
                    </B>
                  </>
                ))}
              </>
            )}
            {onClose && (
              <>
                <span style={{ flex: 1 }} />
                <span onClick={onClose} style={{ cursor: "pointer", fontSize: 13, color: C.muted, fontWeight: 700 }} title="Close">✕</span>
              </>
            )}
          </div>
        )}
      </div>
      )}

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
