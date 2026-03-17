// frontend/src/components/article/ArticleView.tsx
import { useState, useMemo, useRef, useEffect } from "react";
import { useAccount } from "wagmi";
import { useCreateClaim, useStake } from "@verisphere/protocol";
import { C, n, fmt, vc, vb, injectCSS } from "./theme";
import type { Sentence, Article } from "./types";
import B from "./MiniButton";
import PlusButton from "./PlusButton";
import StakeInput from "./StakeInput";
import InlineClaimCard from "./InlineClaimCard";

const API = import.meta.env.VITE_API_BASE || "/api";

export default function ArticleView({
  article,
  onRefresh,
}: {
  article: Article;
  onRefresh: () => void;
}) {
  useEffect(injectCSS, []);
  const { isConnected } = useAccount();
  const { createClaim, loading: txing } = useCreateClaim();
  const { stake, loading: staking } = useStake();
  const [selId, setSelId] = useState<number | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [editPhase, setEditPhase] = useState<
    "edit" | "cleanup" | "confirm" | "creating" | "staking"
  >("edit");
  const [editSug, setEditSug] = useState<{
    original: string;
    suggested: string;
  } | null>(null);
  const [stakeAmt, setStakeAmt] = useState("1");
  const editRef = useRef<HTMLTextAreaElement>(null);

  const allSent = useMemo(() => {
    const r: Sentence[] = [];
    for (const sec of article.sections)
      for (const s of sec.sentences) r.push(s);
    return r;
  }, [article]);

  useEffect(() => {
    if (editId && editRef.current) {
      editRef.current.focus();
      editRef.current.selectionStart = editRef.current.value.length;
    }
  }, [editId]);

  const click = (s: Sentence) => {
    if (editId && editId !== s.sentence_id) {
      setEditId(null);
      setEditPhase("edit");
    }
    if (selId === s.sentence_id) {
      if (editId === s.sentence_id) {
        /* already editing */
      } else if (isConnected) {
        setEditId(s.sentence_id);
        setEditText(s.text);
        setEditPhase("edit");
        setEditSug(null);
        setStakeAmt("1");
      } else {
        setSelId(null);
      }
    } else {
      setSelId(s.sentence_id);
      setEditId(null);
      setEditPhase("edit");
    }
  };
  const collapse = () => {
    setSelId(null);
    setEditId(null);
    setEditPhase("edit");
    setEditSug(null);
  };
  const cancelEdit = () => {
    setEditId(null);
    setEditPhase("edit");
    setEditSug(null);
  };

  // ── Edit flow: cleanup → confirm → create on-chain → stake ──
  // Editing an off-chain sentence = creating a new claim. The original
  // sentence is NOT modified, replaced, or moved. No replaced_by, no
  // challenge links.
  const submitEdit = async () => {
    const old = allSent.find((s) => s.sentence_id === editId);
    if (!old || editText.trim() === old.text) {
      cancelEdit();
      return;
    }
    setEditPhase("cleanup");
    try {
      const d = await fetch(`${API}/article/sentence/cleanup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: editText.trim(), topic: article.title }),
      }).then((r) => r.json());
      if (
        d.suggested &&
        d.suggested.toLowerCase() !== d.original.toLowerCase()
      ) {
        setEditSug(d);
      } else {
        setEditSug({ original: editText.trim(), suggested: editText.trim() });
      }
      setEditPhase("confirm");
    } catch {
      setEditSug({ original: editText.trim(), suggested: editText.trim() });
      setEditPhase("confirm");
    }
  };

  // Commit: create claim on-chain, stake it, insert into article.
  const doCommit = async (final: string) => {
    const sid = editId ?? selId;
    if (!sid) return;

    setEditPhase("creating");

    // 1. Create claim on-chain
    let postId: number | null = null;
    try {
      const result = await createClaim(final);
      postId = result?.post_id ?? null;
      if (postId == null || postId < 0) {
        try {
          const check = await fetch(
            `${API}/claims/check-onchain?text=${encodeURIComponent(final)}`,
          ).then((r) => r.json());
          if (check?.exists && check.post_id != null) postId = check.post_id;
        } catch {}
      }
    } catch (e: any) {
      console.error("createClaim error:", e);
      setEditPhase("edit");
      return;
    }

    if (postId == null || postId < 0) {
      setEditPhase("edit");
      return;
    }

    // 2. Stake
    const amt = parseFloat(stakeAmt);
    if (amt !== 0) {
      setEditPhase("staking");
      try {
        const side = amt > 0 ? "support" : "challenge";
        await stake(postId, side, Math.abs(amt));
      } catch (e: any) {
        console.warn("Initial stake failed (claim created):", e);
      }
    }

    // 3. Insert into article as a new sentence (find the section)
    try {
      let sectionId: number | null = null;
      for (const sec of article.sections) {
        if (sec.sentences.some((s) => s.sentence_id === sid)) {
          sectionId = sec.section_id;
          break;
        }
      }
      if (sectionId != null) {
        const ins = await fetch(`${API}/article/sentence/insert`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            section_id: sectionId,
            after_sentence_id: sid,
            text: final,
          }),
        }).then((r) => r.json());
        for (const i of ins.inserted || []) {
          await fetch(`${API}/article/sentence/${i.sentence_id}/link_post`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ post_id: postId }),
          });
        }
      }
    } catch (e: any) {
      console.warn("Article insert failed (claim is on-chain):", e);
    }

    window.dispatchEvent(new Event("verisphere:data-changed"));
    setEditId(null);
    setEditPhase("edit");
    setEditSug(null);
    setStakeAmt("1");
    onRefresh();
  };

  /* ── section builder ── */
  function buildSection(sec: {
    section_id: number;
    heading: string;
    sentences: Sentence[];
  }) {
    const narrative: Sentence[] = [];
    const disputed: Sentence[] = [];
    const seenPid = new Set<number>();
    const seenText = new Set<string>();

    for (const s of sec.sentences) {
      const key = s.text.toLowerCase().trim();
      const isDup =
        (s.post_id != null && seenPid.has(s.post_id)) || seenText.has(key);
      if (s.post_id != null) seenPid.add(s.post_id);
      seenText.add(key);
      if (isDup) continue;

      // Disputed = on-chain with negative VS only.
      // replaced_by is irrelevant — claims are independent entities.
      if (s.post_id != null && n(s.verity_score) < 0) {
        disputed.push(s);
        continue;
      }
      narrative.push(s);
    }

    // Deduplicate overlapping text (prefer on-chain version)
    const toRemove = new Set<number>();
    for (let i = 0; i < narrative.length; i++) {
      for (let j = i + 1; j < narrative.length; j++) {
        const at = narrative[i].text.toLowerCase().trim();
        const bt = narrative[j].text.toLowerCase().trim();
        if (at.includes(bt) || bt.includes(at)) {
          if (narrative[i].post_id != null && narrative[j].post_id == null)
            toRemove.add(j);
          else if (narrative[j].post_id != null && narrative[i].post_id == null)
            toRemove.add(i);
          else if (at.length >= bt.length) toRemove.add(j);
          else toRemove.add(i);
        }
      }
    }
    const cleanNarrative = narrative.filter((_, i) => !toRemove.has(i));

    const narPids = new Set(
      cleanNarrative.filter((s) => s.post_id != null).map((s) => s.post_id!),
    );
    const narTexts = new Set(
      cleanNarrative.map((s) => s.text.toLowerCase().trim()),
    );
    const finalDisputed = disputed.filter(
      (s) =>
        (s.post_id == null || !narPids.has(s.post_id)) &&
        !narTexts.has(s.text.toLowerCase().trim()),
    );

    finalDisputed.sort((a, b) => {
      const aTotal = n(a.stake_support) + n(a.stake_challenge);
      const bTotal = n(b.stake_support) + n(b.stake_challenge);
      const aContr =
        aTotal > 0
          ? Math.min(n(a.stake_support), n(a.stake_challenge)) /
            Math.max(n(a.stake_support), n(a.stake_challenge), 0.001)
          : 0;
      const bContr =
        bTotal > 0
          ? Math.min(n(b.stake_support), n(b.stake_challenge)) /
            Math.max(n(b.stake_support), n(b.stake_challenge), 0.001)
          : 0;
      if (bContr !== aContr) return bContr - aContr;
      return bTotal - aTotal;
    });
    return { cleanNarrative, finalDisputed };
  }

  const busy =
    editPhase === "cleanup" ||
    editPhase === "creating" ||
    editPhase === "staking";
  const statusText =
    editPhase === "cleanup"
      ? "Checking…"
      : editPhase === "creating"
        ? "Creating claim…"
        : editPhase === "staking"
          ? "Staking…"
          : null;

  /* ════════════════════ render ════════════════════ */
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
      }}
    >
      {/* Fixed header — flexShrink:0 keeps it pinned at top */}
      <div
        style={{
          flexShrink: 0,
          zIndex: 10,
          background: "rgba(255,255,255,0.97)",
          backdropFilter: "blur(6px)",
          borderBottom: `1px solid ${C.gb}`,
          padding: "10px 20px",
        }}
      >
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0, color: C.text }}>
          {article.title}
        </h2>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 20px 40px" }}>
        {article.sections.map((sec) => {
          const { cleanNarrative, finalDisputed } = buildSection(sec);
          return (
            <div key={sec.section_id} style={{ marginBottom: 20 }}>
              {sec.heading && (
                <h3
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: C.text,
                    margin: "0 0 4px",
                  }}
                >
                  {sec.heading}
                </h3>
              )}
              <div style={{ fontSize: 14, lineHeight: 1.75, color: "#374151" }}>
                {cleanNarrative.map((s, i) => {
                  const vs = n(s.verity_score);
                  const onC = s.post_id != null;
                  const isSel = selId === s.sentence_id;
                  const isEd = editId === s.sentence_id;
                  return (
                    <span key={s.sentence_id} className="av-zone">
                      {isEd ? (
                        <span>
                          <textarea
                            ref={editRef}
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                submitEdit();
                              }
                              if (e.key === "Escape") cancelEdit();
                            }}
                            rows={2}
                            style={{
                              width: "100%",
                              padding: "3px 5px",
                              fontSize: 14,
                              lineHeight: 1.5,
                              border: `1px solid ${C.blue}`,
                              borderRadius: 4,
                              resize: "vertical",
                              fontFamily: "inherit",
                              boxSizing: "border-box",
                              background: C.bbg,
                            }}
                          />
                          <div
                            style={{
                              fontSize: 10,
                              color: C.muted,
                              marginBottom: 4,
                            }}
                          >
                            Enter to check &amp; create · Esc to cancel
                          </div>
                        </span>
                      ) : (
                        <span
                          className="av-s"
                          onClick={() => click(s)}
                          style={{
                            background: isSel
                              ? C.bbg
                              : onC
                                ? vb(vs)
                                : "transparent",
                            borderBottom: isSel
                              ? `1.5px solid ${C.blue}`
                              : "none",
                          }}
                        >
                          {s.text}
                          {onC && (
                            <sup
                              style={{
                                fontSize: 8,
                                fontWeight: 600,
                                marginLeft: 1,
                                color: vc(vs),
                              }}
                            >
                              {fmt(vs)}
                            </sup>
                          )}
                        </span>
                      )}{" "}
                      {i < cleanNarrative.length - 1 && " "}
                      {/* Inline claim card on select */}
                      {isSel && !isEd && (
                        <InlineClaimCard
                          postId={s.post_id}
                          text={s.text}
                          stakeSupport={s.stake_support}
                          stakeChallenge={s.stake_challenge}
                          verityScore={s.verity_score}
                          sentenceId={s.sentence_id}
                          allSentences={allSent}
                          onRefresh={onRefresh}
                          onClose={collapse}
                        />
                      )}
                      {/* Confirm panel after cleanup */}
                      {editPhase === "confirm" &&
                        editSug &&
                        (editId === s.sentence_id ||
                          selId === s.sentence_id) && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              display: "block",
                              margin: "4px 0 8px",
                              padding: "8px 10px",
                              background: C.bbg,
                              borderRadius: 6,
                              border: `1px solid ${C.blue}`,
                            }}
                          >
                            {editSug.original !== editSug.suggested ? (
                              <>
                                <div style={{ fontSize: 12, marginBottom: 3 }}>
                                  <b>Your version:</b>{" "}
                                  <span style={{ color: C.gray }}>
                                    {editSug.original}
                                  </span>
                                </div>
                                <div style={{ fontSize: 12, marginBottom: 5 }}>
                                  <b>Suggested:</b> {editSug.suggested}
                                </div>
                              </>
                            ) : (
                              <div style={{ fontSize: 12, marginBottom: 5 }}>
                                <b>Create claim:</b> {editSug.suggested}
                              </div>
                            )}
                            <div
                              style={{
                                display: "flex",
                                gap: 5,
                                alignItems: "center",
                                marginBottom: 4,
                                flexWrap: "wrap",
                              }}
                            >
                              <span style={{ fontSize: 11, color: C.gray }}>
                                Initial stake:
                              </span>
                              <StakeInput
                                value={stakeAmt}
                                onChange={setStakeAmt}
                                onSubmit={() => doCommit(editSug!.suggested)}
                              />
                              <span style={{ fontSize: 10, color: C.muted }}>
                                VSP (1 fee + stake)
                              </span>
                            </div>
                            <div style={{ display: "flex", gap: 5 }}>
                              {editSug.original !== editSug.suggested ? (
                                <>
                                  <B
                                    onClick={() => doCommit(editSug!.suggested)}
                                    dis={busy}
                                  >
                                    {statusText || "Accept & create"}
                                  </B>
                                  <B
                                    onClick={() => doCommit(editSug!.original)}
                                    dis={busy}
                                    sec
                                  >
                                    {statusText || "Keep original"}
                                  </B>
                                </>
                              ) : (
                                <B
                                  onClick={() => doCommit(editSug!.suggested)}
                                  dis={busy}
                                >
                                  {statusText || "Create & stake"}
                                </B>
                              )}
                              <B
                                onClick={() => {
                                  setEditSug(null);
                                  setEditPhase("edit");
                                }}
                                ghost
                              >
                                Cancel
                              </B>
                            </div>
                          </div>
                        )}
                    </span>
                  );
                })}
              </div>

              {/* End-of-section plus button — explicitly visible (not av-plus opacity) */}
              {isConnected && (
                <div
                  style={{
                    marginTop: 8,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <PlusButton
                    sectionId={sec.section_id}
                    afterId={
                      cleanNarrative.length > 0
                        ? cleanNarrative[cleanNarrative.length - 1].sentence_id
                        : null
                    }
                    topic={article.title}
                    onDone={onRefresh}
                  />
                  <span style={{ fontSize: 10, color: C.muted }}>
                    Add claim
                  </span>
                </div>
              )}

              {/* Disputed claims (on-chain with VS < 0 only) */}
              {finalDisputed.length > 0 &&
                (() => {
                  const hasOpenCard = finalDisputed.some(
                    (s) => selId === s.sentence_id,
                  );
                  return (
                    <div
                      style={{
                        marginTop: 4,
                        maxHeight: hasOpenCard ? "none" : 100,
                        overflowY: hasOpenCard ? "visible" : "auto",
                        padding: "4px 8px",
                        background: "rgba(220,50,50,0.03)",
                        borderRadius: 5,
                        borderLeft: "2px solid rgba(220,50,50,0.25)",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 9,
                          fontWeight: 600,
                          color: C.red,
                          marginBottom: 2,
                          textTransform: "uppercase",
                          letterSpacing: 0.4,
                        }}
                      >
                        Disputed
                      </div>
                      {finalDisputed.map((s) => {
                        const vs = n(s.verity_score);
                        const isSel = selId === s.sentence_id;
                        return (
                          <div key={s.sentence_id}>
                            <span
                              onClick={() => {
                                setSelId(
                                  selId === s.sentence_id
                                    ? null
                                    : s.sentence_id,
                                );
                                setEditId(null);
                              }}
                              style={{
                                fontSize: 13,
                                lineHeight: 1.5,
                                color: "rgba(220,50,50,0.7)",
                                cursor: "pointer",
                                background: isSel
                                  ? "rgba(220,50,50,0.08)"
                                  : "transparent",
                                borderRadius: 3,
                                padding: "0 2px",
                              }}
                            >
                              {s.text}
                              {s.post_id != null && (
                                <sup
                                  style={{
                                    fontSize: 8,
                                    fontWeight: 600,
                                    color: C.red,
                                  }}
                                >
                                  {fmt(vs)}
                                </sup>
                              )}
                            </span>
                            {isSel && (
                              <InlineClaimCard
                                postId={s.post_id}
                                text={s.text}
                                stakeSupport={s.stake_support}
                                stakeChallenge={s.stake_challenge}
                                verityScore={s.verity_score}
                                sentenceId={s.sentence_id}
                                allSentences={allSent}
                                onRefresh={onRefresh}
                                onClose={collapse}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
            </div>
          );
        })}
      </div>
    </div>
  );
}
