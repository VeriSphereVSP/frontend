// Target-based stake control: single line with up/down arrows
// User sets their desired total position; component calculates delta
import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { useStake } from "@verisphere/protocol";
import { fireTxProgress } from "./article/TxProgress";

const API = import.meta.env.VITE_API_BASE || "/api";

const C = {
  green: "#16a34a",
  red: "#dc2626",
  muted: "#9ca3af",
  blue: "#2563eb",
  text: "#1f2937",
};

export default function StakeControl({
  postId,
  currentSupport,
  currentChallenge,
  onDone,
  compact = false,
  label,
}: {
  postId: number;
  currentSupport: number;
  currentChallenge: number;
  onDone: () => void;
  compact?: boolean;
  label?: string;
}) {
  const { stake, withdraw } = useStake();
  const { address } = useAccount();
  const [liveSup, setLiveSup] = useState(currentSupport);
  const [liveChal, setLiveChal] = useState(currentChallenge);

  // Fetch live position
  useEffect(() => {
    if (!address || !postId) return;
    fetch(`${API}/claims/${postId}/user-stake?user=${address}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d) {
          setLiveSup(d.user_support || 0);
          setLiveChal(d.user_challenge || 0);
        }
      }).catch(() => {});
  }, [postId, address]);

  // Also sync from props
  useEffect(() => {
    if (currentSupport > 0 || currentChallenge > 0) {
      setLiveSup(currentSupport);
      setLiveChal(currentChallenge);
    }
  }, [currentSupport, currentChallenge]);

  const currentNet = liveSup - liveChal;
  const [target, setTarget] = useState(currentNet.toFixed(2));
  useEffect(() => {
    setTarget(currentNet.toFixed(2));
  }, [liveSup, liveChal]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const targetVal = parseFloat(target) || 0;
  const isSupport = targetVal > 0;
  const isChallenge = targetVal < 0;
  const sideLabel = isSupport ? "support" : isChallenge ? "challenge" : "none";
  const sideColor = isSupport ? C.green : isChallenge ? C.red : C.muted;

  const step = (delta: number) => {
    const newVal = (parseFloat(target) || 0) + delta;
    setTarget(newVal.toFixed(2));
  };

  const doApply = async () => {
    if (postId == null || busy) return;
    const absTarget = Math.abs(targetVal);
    setBusy(true);
    setErr(null);

    fireTxProgress({
      action: "start",
      title: "Updating Stake",
      steps: [{ label: `Set to ${absTarget.toFixed(2)} VSP ${sideLabel}`, status: "active" as const }],
    });

    try {
      if (targetVal === 0) {
        // Liquidate everything
        if (liveSup > 0.001) await withdraw(postId, "support", liveSup);
        if (liveChal > 0.001) await withdraw(postId, "challenge", liveChal);
      } else if (targetVal > 0) {
        // Target is support
        // First withdraw any challenge
        if (liveChal > 0.001) await withdraw(postId, "challenge", liveChal);
        // Then adjust support
        if (absTarget > liveSup + 0.001) {
          await stake(postId, "support", absTarget - liveSup);
        } else if (absTarget < liveSup - 0.001) {
          await withdraw(postId, "support", liveSup - absTarget);
        }
      } else {
        // Target is challenge
        // First withdraw any support
        if (liveSup > 0.001) await withdraw(postId, "support", liveSup);
        // Then adjust challenge
        if (absTarget > liveChal + 0.001) {
          await stake(postId, "challenge", absTarget - liveChal);
        } else if (absTarget < liveChal - 0.001) {
          await withdraw(postId, "challenge", liveChal - absTarget);
        }
      }
      fireTxProgress({ action: "done" });
      // Refresh position after delay
      setTimeout(() => {
        if (address && postId) {
          fetch(`${API}/claims/${postId}/user-stake?user=${address}`)
            .then((r) => r.ok ? r.json() : null)
            .then((d) => {
              if (d) { setLiveSup(d.user_support || 0); setLiveChal(d.user_challenge || 0); }
            }).catch(() => {});
        }
      }, 2000);
      onDone();
    } catch (e: any) {
      setErr(e.message?.slice(0, 60) || "Stake failed");
      fireTxProgress({ action: "error", error: e.message || "Failed" });
    } finally {
      setBusy(false);
    }
  };

  const changed = Math.abs(targetVal - currentNet) > 0.009;
  const fontSize = compact ? 10 : 11;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <span style={{ fontSize, color: C.muted, fontWeight: 600 }}>
        {label || "Your stake on this claim:"}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
        <input
          type="number"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          style={{
            width: 70,
            padding: "2px 4px",
            fontSize,
            border: `1px solid ${changed ? C.blue : "#d1d5db"}`,
            borderRadius: 3,
            textAlign: "right",
            fontWeight: 600,
            color: C.text,
          }}
        />
        <div style={{ display: "flex", flexDirection: "column" as const, gap: 0 }}>
          <button
            onClick={() => step(1)}
            style={{
              border: "none", background: "none", cursor: "pointer",
              fontSize: 8, lineHeight: "10px", padding: 0, color: C.muted,
            }}
          >▲</button>
          <button
            onClick={() => step(-1)}
            style={{
              border: "none", background: "none", cursor: "pointer",
              fontSize: 8, lineHeight: "10px", padding: 0, color: C.muted,
            }}
          >▼</button>
        </div>
        <span style={{ fontSize, fontWeight: 600, color: sideColor, minWidth: 50 }}>
          VSP ({sideLabel})
        </span>
        <span style={{ fontSize: fontSize - 1, color: C.muted }}>
          Total: {(liveSup + liveChal).toFixed(2)}
        </span>
      </div>
      {changed && (
        <button
          onClick={doApply}
          disabled={busy}
          style={{
            padding: "2px 10px",
            fontSize,
            fontWeight: 700,
            border: "none",
            borderRadius: 4,
            background: C.green,
            color: "#fff",
            cursor: busy ? "not-allowed" : "pointer",
            opacity: busy ? 0.6 : 1,
          }}
        >
          {busy ? "…" : "Go"}
        </button>
      )}

      {err && <span style={{ fontSize: 9, color: C.red }}>{err}</span>}
    </div>
  );
}
