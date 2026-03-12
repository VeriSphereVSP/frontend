// frontend/src/components/article/PlusButton.tsx
import { useState, useRef, useEffect } from "react";
import { useAccount } from "wagmi";
import { useCreateClaim, useStake, fetchBalance } from "@verisphere/protocol";
import { C } from "./theme";
import B from "./MiniButton";
import StakeInput from "./StakeInput";

const API = import.meta.env.VITE_API_BASE || "/api";

export default function PlusBtn({
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
  const [stakeAmt, setStakeAmt] = useState("1");
  const [phase, setPhase] = useState<
    "input" | "cleanup" | "confirm" | "creating" | "staking"
  >("input");
  const [sug, setSug] = useState<{
    original: string;
    suggested: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasBalance, setHasBalance] = useState(false);
  const { isConnected, address } = useAccount();
  const { createClaim, loading: txing } = useCreateClaim();
  const { stake, loading: staking } = useStake();
  const r = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open && r.current) r.current.focus();
  }, [open]);

  useEffect(() => {
    if (!open || !address) return;
    fetchBalance(API, address)
      .then((bal) => {
        setHasBalance(bal >= BigInt("1000000000000000000"));
      })
      .catch(() => setHasBalance(false));
  }, [open, address]);

  if (!isConnected) {
    return (
      <span className="av-plus" style={{ display: "inline-block", width: 4 }} />
    );
  }

  const cleanup = async () => {
    if (!txt.trim()) return;
    setPhase("cleanup");
    setError(null);
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
      } else {
        await commit(txt.trim());
      }
    } catch {
      await commit(txt.trim());
    }
  };

  const commit = async (final: string) => {
    setPhase("creating");
    setError(null);

    let postId: number | null = null;
    try {
      const result = await createClaim(final);
      postId = result?.post_id ?? null;
      if (postId == null || postId < 0) {
        const check = await fetch(
          `${API}/claims/check-onchain?text=${encodeURIComponent(final)}`,
        ).then((r) => r.json());
        if (check?.exists && check.post_id != null) postId = check.post_id;
      }
    } catch (e: any) {
      setError(e?.message || "Failed to create claim on-chain");
      setPhase("input");
      return;
    }

    if (postId == null || postId < 0) {
      setError("Claim creation failed. Do you have enough VSP?");
      setPhase("input");
      return;
    }

    // Stake on the new claim
    const amt = parseFloat(stakeAmt);
    if (amt > 0) {
      setPhase("staking");
      try {
        await stake(postId, "support", amt);
      } catch (e: any) {
        console.warn("Initial stake failed (claim created):", e);
      }
    }

    // Insert into article DB
    try {
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
        await fetch(`${API}/article/sentence/${i.sentence_id}/link_post`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ post_id: postId }),
        });
      }
      try {
        await fetch(`${API}/claims/record`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: final, post_id: postId }),
        });
      } catch {}
    } catch (e: any) {
      console.warn("Article insert failed (claim is on-chain):", e);
    }

    window.dispatchEvent(new Event("verisphere:data-changed"));
    setTxt("");
    setStakeAmt("1");
    setSug(null);
    setPhase("input");
    setOpen(false);
    onDone();
  };

  const busy =
    phase === "cleanup" || phase === "creating" || phase === "staking";
  const statusText =
    phase === "cleanup"
      ? "Checking…"
      : phase === "creating"
        ? "Creating claim…"
        : phase === "staking"
          ? "Staking…"
          : null;

  if (!open) {
    return (
      <span
        className="av-plus"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        title="Add a new on-chain claim (1 VSP fee + initial stake)"
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
          cursor: "pointer",
        }}
      >
        +
      </span>
    );
  }

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
      {!hasBalance ? (
        <div>
          <span style={{ fontSize: 12, color: C.red }}>
            Insufficient VSP balance. You need at least 2 VSP (1 fee + 1 stake).
          </span>
          <div style={{ marginTop: 4 }}>
            <B
              onClick={() => {
                setOpen(false);
                setTxt("");
              }}
              ghost
            >
              Close
            </B>
          </div>
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
          <div
            style={{
              display: "flex",
              gap: 4,
              alignItems: "center",
              marginBottom: 4,
            }}
          >
            <span style={{ fontSize: 11, color: C.gray }}>Initial stake:</span>
            <StakeInput
              value={stakeAmt}
              onChange={setStakeAmt}
              onSubmit={() => commit(sug.suggested)}
            />
            <span style={{ fontSize: 10, color: C.muted }}>VSP support</span>
          </div>
          <div style={{ display: "flex", gap: 5 }}>
            <B onClick={() => commit(sug.suggested)} dis={busy}>
              {statusText || "Accept & create"}
            </B>
            <B onClick={() => commit(sug.original)} dis={busy} sec>
              {statusText || "Keep original"}
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
            placeholder="Write a factual claim to add on-chain…"
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
          <div
            style={{
              display: "flex",
              gap: 5,
              marginTop: 4,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <B onClick={cleanup} dis={busy || !txt.trim()}>
              {statusText || "Create & stake"}
            </B>
            <span style={{ fontSize: 10, color: C.muted }}>1 VSP fee +</span>
            <StakeInput
              value={stakeAmt}
              onChange={setStakeAmt}
              onSubmit={cleanup}
            />
            <span style={{ fontSize: 10, color: C.muted }}>VSP stake</span>
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
      {error && (
        <div style={{ fontSize: 11, color: C.red, marginTop: 4 }}>{error}</div>
      )}
    </div>
  );
}
