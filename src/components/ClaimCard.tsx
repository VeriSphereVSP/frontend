import React from "react";
import type { ClaimCard as ClaimCardT } from "../types";
//import { stakeSupport, stakeChallenge } from "@verisphere/protocol"; // now resolves via alias

function pct(n: number) {
  const x = Math.max(0, Math.min(1, n));
  return `${Math.round(x * 100)}%`;
}

export default function ClaimCard({
  card,
  onAction,
}: {
  card: ClaimCardT;
  onAction: (type: string, payload: any) => void;
}) {
  const mainText = (card.text ?? card.claim_text ?? "").toString();

  const handleStakeSupport = async () => {
    if (!card.on_chain?.claim_id) {
      alert("Claim not yet on-chain");
      return;
    }

    try {
      await stakeSupport(BigInt(card.on_chain.claim_id), parseEther("10")); // example amount
      alert("Support stake sent! Check MetaMask for tx.");
    } catch (err: any) {
      alert("Stake failed: " + (err.shortMessage || err.message));
    }
  };

  const handleStakeChallenge = async () => {
    if (!card.on_chain?.claim_id) {
      alert("Claim not yet on-chain");
      return;
    }

    try {
      await stakeChallenge(BigInt(card.on_chain.claim_id), parseEther("5")); // example amount
      alert("Challenge stake sent! Check MetaMask for tx.");
    } catch (err: any) {
      alert("Stake failed: " + (err.shortMessage || err.message));
    }
  };

  return (
    <div className="card claim-card" title="Hoverable Claim Card">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
        <span className="badge">Confidence: {pct(card.confidence)}</span>
        {card.type ? <span className="badge">Type: {card.type}</span> : <span className="badge muted">Type: —</span>}
      </div>

      <p className="claim-text" style={{ marginTop: 10 }}>{mainText}</p>

      <div className="row" style={{ flexWrap: "wrap", marginTop: 10 }}>
        {typeof card.local_id === "string" && <span className="badge">local_id: {card.local_id}</span>}
        {typeof card.claim_id === "number" && <span className="badge">claim_id: {card.claim_id}</span>}
        {typeof card.cluster_id === "number" && <span className="badge">cluster: {card.cluster_id}</span>}
        {typeof card.max_similarity === "number" && <span className="badge">max_sim: {card.max_similarity.toFixed(3)}</span>}
        {typeof card.is_atomic === "boolean" && <span className="badge">{card.is_atomic ? "atomic" : "compound"}</span>}
        {card.classification ? <span className="badge">Dedupe: {card.classification}</span> : null}
      </div>

      {!card.is_atomic && card.decomposition?.length ? (
        <div style={{ marginTop: 10 }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Decomposition</div>
          <ol style={{ margin: 0, paddingLeft: 18 }}>
            {card.decomposition.map((s, i) => (
              <li key={i} style={{ fontSize: 13, marginBottom: 4 }}>{s}</li>
            ))}
          </ol>
        </div>
      ) : null}

      {card.canonical_claim_text ? (
        <div style={{ marginTop: 10 }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>Canonical claim</div>
          <div style={{ fontSize: 13 }}>{card.canonical_claim_text}</div>
        </div>
      ) : null}

      <div className="claim-actions">
        {card.actions?.map((a, i) => (
          <button
            key={i}
            className="btn"
            onClick={() => onAction(a.type, a.payload)}
          >
            {a.label}
          </button>
        ))}

        {/* Staking buttons – only show if claim is on-chain 
        {card.on_chain?.claim_id && (
          <>
            <button className="btn btn-success" onClick={handleStakeSupport}>
              Stake Support
            </button>
            <button className="btn btn-danger" onClick={handleStakeChallenge}>
              Stake Challenge
            </button>
          </>
        )} 
	*/}
      </div>
    </div>
  );
}
