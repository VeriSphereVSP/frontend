// frontend/src/components/article/InlineClaimCard.tsx
import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useAccount } from "wagmi";
import { useCreateClaim } from "../../web3/useCreateClaim";
import { useCreateLink } from "../../web3/useCreateLink";
import { useStake } from "../../web3/useStake";
import { C, n, fmt, vc } from "./theme";
import type { Sentence, Edge } from "./types";
import B from "./MiniButton";
import StakeInput from "./StakeInput";

const API = import.meta.env.VITE_API_BASE || "/api";

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
}: {
  postId: number | null;
  text: string;
  stakeSupport: number;
  stakeChallenge: number;
  verityScore: number;
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
  const [lkSearch, setLkSearch] = useState("");
  const [lkOpen, setLkOpen] = useState(false);
  const [lkPick, setLkPick] = useState<Sentence | null>(null);
  const [lkType, setLkType] = useState<"support" | "challenge">("support");
  const [lkDir, setLkDir] = useState<"outgoing" | "incoming">("outgoing");
  const lkRef = useRef<HTMLDivElement>(null);
  const vs = n(verityScore);
  const [resolvedPid, setResolvedPid] = useState<number | null>(postId);
  const [checking, setChecking] = useState(false);
  const pid = resolvedPid;

  /* ── on-chain duplicate check: if postId is null, ask backend ── */
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
          // Also link the sentence in the DB
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
        ...(i.edges || []).map((e: any) => ({ ...e, _dir: "incoming" })),
        ...(o.edges || []).map((e: any) => ({ ...e, _dir: "outgoing" })),
      ]);
    } catch {
      setEdges([]);
    }
    setELoading(false);
  }, [pid]);
  useEffect(() => {
    refreshEdges();
  }, [refreshEdges]);

  const allLinks = [
    ...edges.filter((e) => e._dir === "incoming" && !e.is_challenge),
    ...edges.filter((e) => e._dir === "incoming" && e.is_challenge),
    ...edges.filter((e) => e._dir === "outgoing"),
  ];

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
          const toWithdraw = Math.min(userChal, absVal);
          await withdraw(pid, "challenge", toWithdraw);
          const remainder = absVal - toWithdraw;
          if (remainder > 0.001) await stake(pid, "support", remainder);
        } else {
          await stake(pid, "support", absVal);
        }
      } else {
        if (userSup > 0) {
          const toWithdraw = Math.min(userSup, absVal);
          await withdraw(pid, "support", toWithdraw);
          const remainder = absVal - toWithdraw;
          if (remainder > 0.001) await stake(pid, "challenge", remainder);
        } else {
          await stake(pid, "challenge", absVal);
        }
      }
    } catch (e: any) {
      console.error("Stake action failed:", e);
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
    const result = await createClaim(text);
    const newPid = result?.post_id;
    if (newPid != null) {
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
      onRefresh();
    } else {
      // createClaim returned null — might be duplicate not yet detected.
      // Re-check on-chain as fallback.
      try {
        const check = await fetch(
          `${API}/claims/check-onchain?text=${encodeURIComponent(text)}`,
        ).then((r) => r.json());
        if (check?.exists && check.post_id != null) {
          setResolvedPid(check.post_id);
          await fetch(`${API}/article/sentence/${sentenceId}/link_post`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ post_id: check.post_id }),
          });
          onRefresh();
          return;
        }
      } catch {}
      setTimeout(onRefresh, 3000);
    }
  };

  /* ── link picker ── */
  const lkCands = useMemo(
    () =>
      (allSentences || []).filter(
        (s) => s.post_id != null && s.post_id !== pid,
      ),
    [allSentences, pid],
  );
  const lkFilt = useMemo(() => {
    if (!lkSearch.trim()) return lkCands;
    const q = lkSearch.toLowerCase();
    return lkCands.filter((s) => s.text.toLowerCase().includes(q));
  }, [lkCands, lkSearch]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (lkRef.current && !lkRef.current.contains(e.target as Node))
        setLkOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const doLink = async () => {
    if (lkPick?.post_id == null || pid == null) return;
    if (lkDir === "outgoing") {
      await createLink(lkPick.post_id, pid, lkType === "challenge");
    } else {
      await createLink(pid, lkPick.post_id, lkType === "challenge");
    }
    setLkPick(null);
    setLkSearch("");
    refreshEdges();
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
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {/* ── LEFT: claim info + stake row ── */}
        <div style={{ flex: "1 1 260px", minWidth: 220 }}>
          {/* Row 1: header */}
          <div
            style={{
              display: "flex",
              gap: 6,
              fontSize: 11,
              alignItems: "center",
              marginBottom: 5,
              flexWrap: "wrap",
            }}
          >
            {pid != null ? (
              <>
                <span style={{ fontWeight: 700, color: C.text }}>
                  Claim#{pid}
                </span>
                <span
                  style={{ color: vs >= 0 ? C.green : C.red, fontSize: 12 }}
                >
                  {vs >= 0 ? "▲" : "▼"}
                </span>
                <span style={{ fontWeight: 700, color: vc(vs) }}>
                  VS {fmt(vs)}
                </span>
                {isConnected && (
                  <span style={{ marginLeft: 6, color: C.muted, fontSize: 10 }}>
                    position:{" "}
                    <span style={{ color: posColor, fontWeight: 600 }}>
                      {posLabel}
                    </span>
                  </span>
                )}
              </>
            ) : checking ? (
              <span style={{ color: C.muted, fontStyle: "italic" }}>
                Checking on-chain…
              </span>
            ) : (
              <span style={{ color: C.muted }}>Not on chain</span>
            )}
            {onClose && (
              <span
                onClick={onClose}
                style={{
                  marginLeft: "auto",
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
            )}
          </div>

          {/* Register if needed — only shown after on-chain check confirms it's truly new */}
          {isConnected && pid == null && sentenceId && !checking && (
            <div style={{ marginBottom: 3 }}>
              {needsApproval ? (
                <B onClick={approveVSP}>Approve VSP</B>
              ) : (
                <B onClick={registerOnChain} dis={txing}>
                  {txing ? "Creating…" : "Register on chain (1 VSP)"}
                </B>
              )}
            </div>
          )}
          {isConnected && pid == null && checking && (
            <div style={{ marginBottom: 3, fontSize: 10, color: C.muted }}>
              Checking on-chain status…
            </div>
          )}

          {/* Row 2: stake */}
          {isConnected &&
            pid != null &&
            (() => {
              if (stakeNeedsApproval)
                return (
                  <div
                    style={{
                      display: "flex",
                      gap: 6,
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    <span style={{ fontSize: 10, color: C.gray }}>
                      VSP approval needed for staking.
                    </span>
                    <B onClick={stakeApproveVSP} dis={staking}>
                      {staking ? "Approving..." : "Approve"}
                    </B>
                  </div>
                );
              const val = parseFloat(amt);
              const isPos = !isNaN(val) && val > 0;
              const isNeg = !isNaN(val) && val < 0;
              return (
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  <span
                    style={{ fontSize: 10, fontWeight: 600, color: C.gray }}
                  >
                    Stake:
                  </span>
                  <StakeInput value={amt} onChange={setAmt} onSubmit={doGo} />
                  <B onClick={doGo} dis={staking || !amt}>
                    {staking ? "…" : "Go"}
                  </B>
                  <span style={{ fontSize: 9, marginLeft: 2 }}>
                    <span
                      style={{
                        color: isPos ? C.green : C.muted,
                        fontWeight: isPos ? 700 : 400,
                      }}
                    >
                      + support
                    </span>
                    <span style={{ color: C.muted }}> · </span>
                    <span
                      style={{
                        color: isNeg ? C.red : C.muted,
                        fontWeight: isNeg ? 700 : 400,
                      }}
                    >
                      − challenge
                    </span>
                  </span>
                </div>
              );
            })()}

          {(claimError || stakeError || goError) && (
            <div style={{ fontSize: 9, color: C.red, marginTop: 2 }}>
              {claimError || stakeError || goError}
            </div>
          )}
        </div>

        {/* ── RIGHT: evidence links ── */}
        {pid != null && (
          <div
            style={{
              flex: "1 1 200px",
              minWidth: 180,
              borderLeft: `1px solid ${C.gb}`,
              paddingLeft: 10,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            <div style={{ maxHeight: 52, overflowY: "auto", marginBottom: 3 }}>
              {eLoading ? (
                <span style={{ fontSize: 9, color: C.muted }}>…</span>
              ) : allLinks.length === 0 ? (
                <span style={{ fontSize: 9, color: C.muted, lineHeight: 1.6 }}>
                  No evidence links yet.
                  <br />
                  Use "Link" below to connect related claims.
                </span>
              ) : (
                <>
                  {allLinks.filter((e) => e._dir === "incoming").length > 0 && (
                    <>
                      <div
                        style={{
                          fontSize: 8,
                          color: C.muted,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: ".03em",
                        }}
                      >
                        Links from (evidence for this claim)
                      </div>
                      {allLinks
                        .filter((e) => e._dir === "incoming")
                        .map((e, i) => {
                          const isC = e.is_challenge;
                          return (
                            <div
                              key={`in${i}`}
                              style={{
                                fontSize: 10,
                                padding: "1px 0",
                                display: "flex",
                                gap: 3,
                                alignItems: "baseline",
                              }}
                            >
                              <span
                                title={
                                  isC
                                    ? "Challenges this claim"
                                    : "Supports this claim"
                                }
                                style={{
                                  color: isC ? C.red : C.green,
                                  fontSize: 9,
                                  cursor: "help",
                                }}
                              >
                                {isC ? "👎" : "👍"}
                              </span>
                              <span
                                style={{
                                  flex: 1,
                                  color: isC ? "rgba(220,50,50,0.75)" : C.text,
                                }}
                              >
                                {(e.claim_text || `#${e.claim_post_id}`).slice(
                                  0,
                                  35,
                                )}
                                {(e.claim_text || "").length > 35 ? "…" : ""}
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
                          );
                        })}
                    </>
                  )}
                  {allLinks.filter((e) => e._dir === "outgoing").length > 0 && (
                    <>
                      <div
                        style={{
                          fontSize: 8,
                          color: C.muted,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: ".03em",
                          marginTop:
                            allLinks.filter((e) => e._dir === "incoming")
                              .length > 0
                              ? 3
                              : 0,
                        }}
                      >
                        Links to (this claim is evidence for)
                      </div>
                      {allLinks
                        .filter((e) => e._dir === "outgoing")
                        .map((e, i) => {
                          const isC = e.is_challenge;
                          return (
                            <div
                              key={`out${i}`}
                              style={{
                                fontSize: 10,
                                padding: "1px 0",
                                display: "flex",
                                gap: 3,
                                alignItems: "baseline",
                              }}
                            >
                              <span
                                title={
                                  isC
                                    ? "Challenges that claim"
                                    : "Supports that claim"
                                }
                                style={{
                                  color: isC ? C.red : C.green,
                                  fontSize: 9,
                                  cursor: "help",
                                }}
                              >
                                {isC ? "⚔→" : "✦→"}
                              </span>
                              <span style={{ flex: 1, color: C.text }}>
                                {(e.claim_text || `#${e.claim_post_id}`).slice(
                                  0,
                                  35,
                                )}
                                {(e.claim_text || "").length > 35 ? "…" : ""}
                              </span>
                            </div>
                          );
                        })}
                    </>
                  )}
                </>
              )}
            </div>

            {/* Link creation */}
            {isConnected && (
              <div ref={lkRef}>
                <div
                  style={{
                    display: "flex",
                    gap: 3,
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ position: "relative", flex: 1, minWidth: 70 }}>
                    <input
                      value={lkSearch}
                      onChange={(e) => {
                        setLkSearch(e.target.value);
                        setLkOpen(true);
                        setLkPick(null);
                      }}
                      onFocus={() => setLkOpen(true)}
                      placeholder="Search claim to link…"
                      style={{
                        width: "100%",
                        padding: "2px 4px",
                        borderRadius: 3,
                        border: `1px solid ${C.gb}`,
                        fontSize: 9,
                        boxSizing: "border-box",
                      }}
                    />
                    {lkOpen && lkFilt.length > 0 && (
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
                          maxHeight: 100,
                          overflowY: "auto",
                          boxShadow: "0 3px 8px rgba(0,0,0,.06)",
                        }}
                      >
                        {lkFilt.slice(0, 8).map((s) => (
                          <div
                            key={s.sentence_id}
                            onClick={() => {
                              setLkPick(s);
                              setLkSearch(s.text.slice(0, 35));
                              setLkOpen(false);
                            }}
                            style={{
                              padding: "2px 4px",
                              cursor: "pointer",
                              fontSize: 9,
                              borderBottom: `1px solid ${C.gl}`,
                            }}
                          >
                            {s.text.slice(0, 45)}
                            {s.text.length > 45 ? "…" : ""}
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
                      setLkDir(lkDir === "outgoing" ? "incoming" : "outgoing")
                    }
                    title={
                      lkDir === "outgoing"
                        ? "This claim → target (click to flip)"
                        : "Target → this claim (click to flip)"
                    }
                    style={{
                      fontSize: 9,
                      fontWeight: 600,
                      cursor: "pointer",
                      padding: "1px 5px",
                      borderRadius: 3,
                      background: C.blue,
                      color: C.white,
                      userSelect: "none",
                    }}
                  >
                    {lkDir === "outgoing" ? "→" : "←"}
                  </span>
                  <span
                    onClick={() =>
                      setLkType(lkType === "support" ? "challenge" : "support")
                    }
                    title={
                      lkType === "support"
                        ? "Support link (click for challenge)"
                        : "Challenge link (click for support)"
                    }
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      cursor: "pointer",
                      padding: "1px 6px",
                      borderRadius: 3,
                      background: lkType === "support" ? C.green : C.red,
                      color: C.white,
                      userSelect: "none",
                    }}
                  >
                    {lkType === "support" ? "👍" : "👎"}
                  </span>
                  <B onClick={doLink} dis={linking || !lkPick}>
                    {linking ? "…" : "Link"}
                  </B>
                </div>
                {lkPick && (
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
                      const picked = `"${lkPick.text.slice(0, 30)}${lkPick.text.length > 30 ? "…" : ""}"`;
                      const thisC = `"${text.slice(0, 30)}${text.length > 30 ? "…" : ""}"`;
                      const verb =
                        lkType === "support" ? "supports" : "challenges";
                      if (lkDir === "outgoing")
                        return (
                          <>
                            {thisC}{" "}
                            <b
                              style={{
                                color: lkType === "support" ? C.green : C.red,
                              }}
                            >
                              {verb}
                            </b>{" "}
                            {picked}
                          </>
                        );
                      return (
                        <>
                          {picked}{" "}
                          <b
                            style={{
                              color: lkType === "support" ? C.green : C.red,
                            }}
                          >
                            {verb}
                          </b>{" "}
                          {thisC}
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
