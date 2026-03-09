// frontend/src/components/article/PlusButton.tsx
import { useState, useRef, useEffect } from "react";
import { useAccount } from "wagmi";
import { useCreateClaim } from "@verisphere/protocol";
import { C } from "./theme";
import B from "./MiniButton";

const API = import.meta.env.VITE_API_BASE || "/api";

/**
 * Inline "+" button that expands into a sentence-insertion form.
 * Handles AI cleanup, VSP approval, and on-chain claim creation.
 */
export default function PlusButton({
  sectionId,
  afterId,
  topic,
  onDone,
}: {
  sectionId: number;
  afterId: number | null;
  topic: string;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [txt, setTxt] = useState("");
  const [phase, setPhase] = useState<"input" | "cleanup" | "confirm" | "tx">(
    "input",
  );
  const [sug, setSug] = useState<{
    original: string;
    suggested: string;
  } | null>(null);
  const { isConnected, address: userAddress } = useAccount();
  const {
    createClaim,
    loading: txing,
    needsApproval,
    approveVSP,
    error,
  } = useCreateClaim();
  const r = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open && r.current) r.current.focus();
  }, [open]);

  if (!isConnected)
    return (
      <span className="av-plus" style={{ display: "inline-block", width: 4 }} />
    );

  const cleanup = async () => {
    if (!txt.trim()) return;
    setPhase("cleanup");
    try {
      const d = await fetch(`${API}/article/sentence/cleanup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: txt.trim(), topic }),
      }).then((r) => r.json());
      if (
        d.suggested &&
        d.suggested.toLowerCase() !== d.original.toLowerCase()
      ) {
        setSug(d);
        setPhase("confirm");
      } else await commit(txt.trim());
    } catch {
      await commit(txt.trim());
    }
  };

  const commit = async (final: string) => {
    setPhase("tx");
    const ins = await fetch(`${API}/article/sentence/insert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        section_id: sectionId,
        after_sentence_id: afterId,
        text: final,
      }),
    }).then((r) => r.json());
    for (const i of ins.inserted || []) {
      if (!i.post_id) {
        const c = await createClaim(i.text);
        if (c?.post_id)
          await fetch(`${API}/article/sentence/${i.sentence_id}/link_post`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ post_id: c.post_id }),
          });
      }
    }
    setTxt("");
    setSug(null);
    setPhase("input");
    setOpen(false);
    onDone();
  };

  if (!open)
    return (
      <span
        className="av-plus"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 14,
          height: 14,
          borderRadius: "50%",
          background: C.blue,
          color: C.white,
          fontSize: 10,
          fontWeight: 700,
          margin: "0 2px",
          lineHeight: 1,
          userSelect: "none",
        }}
      >
        +
      </span>
    );

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        display: "block",
        margin: "6px 0",
        padding: "8px 10px",
        background: C.bbg,
        borderRadius: 6,
        border: `1px solid ${C.blue}`,
      }}
    >
      {needsApproval ? (
        <div>
          <span style={{ fontSize: 12, color: C.gray }}>
            VSP approval needed.{" "}
          </span>
          <B
            onClick={() => {
              console.log("Approve clicked, userAddress:", !!userAddress);
              approveVSP();
            }}
          >
            {txing ? "Approving…" : "Approve"}
          </B>
          {error && (
            <div style={{ fontSize: 10, color: "#dc2626", marginTop: 3 }}>
              {error}
            </div>
          )}
        </div>
      ) : phase === "confirm" && sug ? (
        <div>
          <div style={{ fontSize: 12, marginBottom: 3 }}>
            <b>Your version:</b>{" "}
            <span style={{ color: C.gray }}>{sug.original}</span>
          </div>
          <div style={{ fontSize: 12, marginBottom: 5 }}>
            <b>Suggested:</b> {sug.suggested}
          </div>
          <div style={{ display: "flex", gap: 5 }}>
            <B onClick={() => commit(sug.suggested)} dis={txing}>
              {txing ? "…" : "Accept (1 VSP)"}
            </B>
            <B onClick={() => commit(sug.original)} dis={txing} sec>
              {txing ? "…" : "Keep original (1 VSP)"}
            </B>
            <B
              onClick={() => {
                setSug(null);
                setPhase("input");
              }}
              ghost
            >
              Cancel
            </B>
          </div>
        </div>
      ) : (
        <div>
          <textarea
            ref={r}
            value={txt}
            onChange={(e) => setTxt(e.target.value)}
            placeholder="Write a new sentence…"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                cleanup();
              }
              if (e.key === "Escape") {
                setOpen(false);
                setTxt("");
              }
            }}
            rows={2}
            style={{
              width: "100%",
              padding: "3px 5px",
              fontSize: 14,
              lineHeight: 1.5,
              border: `1px solid ${C.gb}`,
              borderRadius: 4,
              resize: "vertical",
              fontFamily: "inherit",
              boxSizing: "border-box",
            }}
          />
          <div style={{ display: "flex", gap: 5, marginTop: 3 }}>
            <B onClick={cleanup} dis={phase === "cleanup" || !txt.trim()}>
              {phase === "cleanup" ? "Checking…" : "Create on-chain (1 VSP)"}
            </B>
            <B
              onClick={() => {
                setOpen(false);
                setTxt("");
              }}
              ghost
            >
              Cancel
            </B>
          </div>
        </div>
      )}
    </div>
  );
}
