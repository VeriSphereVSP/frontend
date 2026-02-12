import React from "react";
import type { ClaimCard as ClaimCardT } from "../types";
import { useAccount } from "wagmi";

function getBackgroundColor(vs: number) {
  if (vs > 0) return `rgba(0, 255, 0, ${Math.min(0.8, vs / 100)})`;
  if (vs < 0) return `rgba(255, 0, 0, ${Math.min(0.8, Math.abs(vs) / 100)})`;
  return "white";
}

export default function ClaimCard({
  card,
  onCreate,
  onStake,
}: {
  card: ClaimCardT;
  onCreate?: (text: string) => void;
  onStake?: (claimId: number, side: "support" | "challenge", amount: number) => void;
}) {
  const { isConnected } = useAccount();
  const vs = card.verity_score || 0;
  const support = card.stake_support || 0;
  const challenge = card.stake_challenge || 0;
  const totalStake = support + challenge;
  const supportPct = totalStake > 0 ? (support / totalStake) * 100 : 0;
  const challengePct = totalStake > 0 ? (challenge / totalStake) * 100 : 0;

  return (
    <div className="card claim-card" style={{ border: "2px solid #ddd" }}>
      {/* Outbound links – at top */}
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <button className="btn btn-small" title="Links from this claim">
          ▲ Outbound links →
        </button>
      </div>

      {/* Claim text */}
      <p style={{ backgroundColor: getBackgroundColor(vs), padding: "12px", borderRadius: 10, marginBottom: 24 }}>
        {card.text}
      </p>

      {/* Queues as vertical gauges – clickable for staking */}
      <div className="queues" style={{ display: "flex", justifyContent: "center", gap: 48, margin: "32px 0" }}>
        <div
          className="gauge-container"
          onClick={() => onStake?.(card.on_chain?.claim_id || 0, "support", 10)}
          style={{ cursor: card.on_chain ? "pointer" : "default" }}
        >
          <div style={{ height: 200, background: "#f5f5f5", borderRadius: 14, overflow: "hidden", position: "relative" }}>
            <div
              className="gauge-fill green"
              style={{ height: `${supportPct}%`, background: "linear-gradient(to top, #00cc44, #66ff99)" }}
            />
            <div className="gauge-label">
              Support Queue<br />{support}
            </div>
          </div>
        </div>

        <div
          className="gauge-container"
          onClick={() => onStake?.(card.on_chain?.claim_id || 0, "challenge", 10)}
          style={{ cursor: card.on_chain ? "pointer" : "default" }}
        >
          <div style={{ height: 200, background: "#f5f5f5", borderRadius: 14, overflow: "hidden", position: "relative" }}>
            <div
              className="gauge-fill red"
              style={{ height: `${challengePct}%`, background: "linear-gradient(to top, #ff4444, #ff9999)" }}
            />
            <div className="gauge-label">
              Challenge Queue<br />{challenge}
            </div>
          </div>
        </div>
      </div>

      {/* Verity Score */}
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <span className="badge">
          Verity Score: <strong style={{ color: vs > 0 ? "green" : vs < 0 ? "red" : "gray" }}>{vs}</strong>
        </span>
      </div>

      {/* Author */}
      {card.author && <div style={{ textAlign: "center", marginBottom: 20 }}>Author: {card.author}</div>}

      {/* Actions */}
      <div className="actions" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {card.on_chain ? (
          <div style={{ textAlign: "center", fontSize: 13, color: "#555" }}>
            Click a queue above to stake
          </div>
        ) : isConnected ? (
          <button onClick={() => onCreate?.(card.text)} style={{ width: "100%" }}>
            Create On-Chain
          </button>
        ) : (
          <div className="connect-warning">
            Connect a wallet to create and/or stake this claim.
          </div>
        )}

        {/* Inbound links – at bottom */}
        <div style={{ textAlign: "center" }}>
          <button className="btn btn-small" title="Links to this claim">
            Inbound links →
          </button>
        </div>
      </div>
    </div>
  );
}
