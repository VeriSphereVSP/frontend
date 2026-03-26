// Target-based stake control: single line with up/down arrows
// User sets their desired total position; component calculates delta
import { useState, useEffect } from "react";
import { useStake } from "@verisphere/protocol";
import { fireTxProgress } from "./article/TxProgress";

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
}: {
  postId: number;
  currentSupport: number;
  currentChallenge: number;
  onDone: () => void;
  compact?: boolean;
}) {
  const { stake, withdraw } = useStake();
  const currentNet = currentSupport - currentChallenge; // positive = support, negative = challenge
  const [target, setTarget] = useState(currentNet.toFixed(2));
  // Sync target when props change (e.g. after async fetch)
  useEffect(() => {
    setTarget(currentNet.toFixed(2));
  }, [currentSupport, currentChallenge]);
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
        if (currentSupport > 0.001) await withdraw(postId, "support", currentSupport);
        if (currentChallenge > 0.001) await withdraw(postId, "challenge", currentChallenge);
      } else if (targetVal > 0) {
        // Target is support
        // First withdraw any challenge
        if (currentChallenge > 0.001) await withdraw(postId, "challenge", currentChallenge);
        // Then adjust support
        if (absTarget > currentSupport + 0.001) {
          await stake(postId, "support", absTarget - currentSupport);
        } else if (absTarget < currentSupport - 0.001) {
          await withdraw(postId, "support", currentSupport - absTarget);
        }
      } else {
        // Target is challenge
        // First withdraw any support
        if (currentSupport > 0.001) await withdraw(postId, "support", currentSupport);
        // Then adjust challenge
        if (absTarget > currentChallenge + 0.001) {
          await stake(postId, "challenge", absTarget - currentChallenge);
        } else if (absTarget < currentChallenge - 0.001) {
          await withdraw(postId, "challenge", currentChallenge - absTarget);
        }
      }
      fireTxProgress({ action: "done" });
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
        Your stake on this claim:
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
