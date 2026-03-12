// frontend/src/components/article/ArticleView.tsx
import { useState, useMemo, useRef, useEffect } from "react";
import { useAccount } from "wagmi";
import { useCreateClaim } from "@verisphere/protocol";
import { C, n, fmt, vc, vb, injectCSS } from "./theme";
import type { Sentence, Article } from "./types";
import B from "./MiniButton";
import PlusButton from "./PlusButton";
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
  const [selId, setSelId] = useState<number | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [editPhase, setEditPhase] = useState<
    "edit" | "cleanup" | "confirm" | "tx"
  >("edit");
  const [editSug, setEditSug] = useState<{
    original: string;
    suggested: string;
  } | null>(null);
  const editRef = useRef<HTMLTextAreaElement>(null);

  const allSent = useMemo(() => {
    const r: Sentence[] = [];
    for (const sec of article.sections)
      for (const s of sec.sentences) if (!s.replaced_by) r.push(s);
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
        setEditPhase("confirm");
        setEditId(null);
      } else await doEdit(editText.trim());
    } catch {
      await doEdit(editText.trim());
    }
  };

  const doEdit = async (final: string) => {
    setEditPhase("tx");
    const sid = editId ?? selId;
    if (!sid) return;
    const d = await fetch(`${API}/article/sentence/${sid}/edit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ new_text: final }),
    }).then((r) => r.json());
    for (const c of d.created || []) {
      let pid = c.post_id;
      if (pid == null) {
        const result = await createClaim(c.text);
        if (result?.post_id != null) {
          pid = result.post_id;
          await fetch(`${API}/article/sentence/${c.sentence_id}/link_post`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ post_id: pid }),
          });
        }
      }
      if (pid != null && d.old_post_id != null && pid !== d.old_post_id) {
        try {
          await fetch(`${API}/links/create`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              independent_post_id: pid,
              dependent_post_id: d.old_post_id,
              is_challenge: true,
            }),
          });
        } catch (e) {
          console.warn("Challenge link failed:", e);
        }
      }
    }
    setEditId(null);
    setEditPhase("edit");
    setEditSug(null);
    onRefresh();
  };

  /* ── dedup helpers ── */
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
      if (s.replaced_by != null) {
        disputed.push(s);
        continue;
      }
      if (s.post_id != null && n(s.verity_score) <= 0) {
        disputed.push(s);
        continue;
      }
      narrative.push(s);
    }

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

    // Sort disputed: controversy desc, then total stake desc
    finalDisputed.sort((a, b) => {
      const aTotal = n(a.stake_support) + n(a.stake_challenge);
      const bTotal = n(b.stake_support) + n(b.stake_challenge);
      // Controversy = min(support, challenge) / max(support, challenge) — higher is more controversial
      const aContr = aTotal > 0 ? Math.min(n(a.stake_support), n(a.stake_challenge)) / Math.max(n(a.stake_support), n(a.stake_challenge), 0.001) : 0;
      const bContr = bTotal > 0 ? Math.min(n(b.stake_support), n(b.stake_challenge)) / Math.max(n(b.stake_support), n(b.stake_challenge), 0.001) : 0;
      if (bContr !== aContr) return bContr - aContr;
      return bTotal - aTotal;
    });
    return { cleanNarrative, finalDisputed };
  }

  /* ════════════════════ render ════════════════════ */
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 155px)",
      }}
    >
      <div style={{ flex: 1, overflowY: "auto" }}>
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 10,
            background: "rgba(255,255,255,0.97)",
            backdropFilter: "blur(6px)",
            borderBottom: `1px solid ${C.gb}`,
            padding: "10px 20px",
          }}
        >
          <h2
            style={{ fontSize: 20, fontWeight: 700, margin: 0, color: C.text }}
          >
            {article.title}
          </h2>
        </div>

        <div style={{ padding: "12px 20px 40px" }}>
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
                <div
                  style={{ fontSize: 14, lineHeight: 1.75, color: "#374151" }}
                >
                  <PlusButton
                    sectionId={sec.section_id}
                    afterId={null}
                    topic={article.title}
                    onDone={onRefresh}
                  />
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
                              Enter to save · Esc to cancel
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
                        <PlusButton
                          sectionId={sec.section_id}
                          afterId={s.sentence_id}
                          topic={article.title}
                          onDone={onRefresh}
                        />
                        {i < cleanNarrative.length - 1 && " "}
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
                        {editPhase === "confirm" &&
                          editSug &&
                          selId === s.sentence_id && (
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
                              <div style={{ fontSize: 12, marginBottom: 3 }}>
                                <b>Your version:</b>{" "}
                                <span style={{ color: C.gray }}>
                                  {editSug.original}
                                </span>
                              </div>
                              <div style={{ fontSize: 12, marginBottom: 5 }}>
                                <b>Suggested:</b> {editSug.suggested}
                              </div>
                              <div style={{ display: "flex", gap: 5 }}>
                                <B
                                  onClick={() => doEdit(editSug.suggested)}
                                  dis={txing}
                                >
                                  {txing ? "Creating…" : "Accept (1 VSP)"}
                                </B>
                                <B
                                  onClick={() => doEdit(editSug.original)}
                                  dis={txing}
                                  sec
                                >
                                  {txing
                                    ? "Creating…"
                                    : "Keep original (1 VSP)"}
                                </B>
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

                {/* Disputed claims */}
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
                          Disputed / Under Review
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
    </div>
  );
}
