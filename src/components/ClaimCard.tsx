import React from "react";
import type { ClaimCard as ClaimCardT } from "../types";
import VSBar from "../ui/VSBar";

export default function ClaimCard({
  card,
  onAction,
}: {
  card: ClaimCardT;
  onAction?: (type: string, payload: any) => void;
}) {
  if (!card) {
    return (
      <div className="card muted">
        Invalid claim data
      </div>
    );
  }
  const mainText = (card.text ?? card.claim_text ?? "").toString();

  return (
    <div
      className="card claim-card"
      style={{
        width: 380,
        background: "white", // always neutral
      }}
    >
      {/* ───────────────────────────────────────────── */}
      {/* ▲ OUTGOING LINKS (this claim affects others) */}
      {/* ───────────────────────────────────────────── */}
      <div
        style={{
          textAlign: "center",
          marginBottom: 8,
        }}
      >
        <button className="btn btn-small" title="Outgoing links">
          ▲ Outgoing links
        </button>
      </div>

      {/* ───────────────────────────────────────────── */}
      {/* METADATA BADGES */}
      {/* ───────────────────────────────────────────── */}
      <div
        className="row"
        style={{
          justifyContent: "space-between",
          alignItems: "baseline",
          flexWrap: "wrap",
          gap: 6,
        }}
      >
        {typeof card.local_id === "string" && (
          <span className="badge">local_id: {card.local_id}</span>
        )}
        {typeof card.claim_id === "number" && (
          <span className="badge">claim_id: {card.claim_id}</span>
        )}
        {typeof card.cluster_id === "number" && (
          <span className="badge">cluster: {card.cluster_id}</span>
        )}
        {typeof card.max_similarity === "number" && (
          <span className="badge">
            max_sim: {card.max_similarity.toFixed(3)}
          </span>
        )}
        {typeof card.is_atomic === "boolean" && (
          <span className="badge">
            {card.is_atomic ? "atomic" : "compound"}
          </span>
        )}
        {card.classification && (
          <span className="badge">Dedupe: {card.classification}</span>
        )}
      </div>

      {/* ───────────────────────────────────────────── */}
      {/* CLAIM TEXT */}
      {/* ───────────────────────────────────────────── */}
      <p
        className="claim-text"
        style={{ marginTop: 12, fontSize: 15 }}
      >
        {mainText}
      </p>

      {/* ───────────────────────────────────────────── */}
      {/* eVS INDICATOR (replaces confidence entirely) */}
      {/* ───────────────────────────────────────────── */}
      <VSBar evs={card.evs} />

      {/* ───────────────────────────────────────────── */}
      {/* STAKE QUEUES (display only for now) */}
      {/* ───────────────────────────────────────────── */}
      <div
        className="row"
        style={{
          marginTop: 10,
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <span className="badge">
          Support stake: {card.stake_support ?? 0}
        </span>
        <span className="badge">
          Challenge stake: {card.stake_challenge ?? 0}
        </span>
      </div>

      {/* ───────────────────────────────────────────── */}
      {/* DECOMPOSITION */}
      {/* ───────────────────────────────────────────── */}
      {!card.is_atomic && card.decomposition?.length ? (
        <div style={{ marginTop: 12 }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
            Decomposition
          </div>
          <ol style={{ margin: 0, paddingLeft: 18 }}>
            {card.decomposition.map((s: string, i: number) => (
              <li
                key={i}
                style={{ fontSize: 13, marginBottom: 4 }}
              >
                {s}
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {/* ───────────────────────────────────────────── */}
      {/* CANONICAL CLAIM */}
      {/* ───────────────────────────────────────────── */}
      {card.canonical_claim_text ? (
        <div style={{ marginTop: 12 }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
            Canonical claim
          </div>
          <div style={{ fontSize: 13 }}>
            {card.canonical_claim_text}
          </div>
        </div>
      ) : null}

      {/* ───────────────────────────────────────────── */}
      {/* ACTION BUTTONS */}
      {/* ───────────────────────────────────────────── */}
      {card.actions?.length ? (
        <div
          className="claim-actions"
          style={{
            marginTop: 14,
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          {card.actions.map((a: any, i: number) => (
            <button
              key={i}
              className="btn"
              onClick={() => onAction?.(a.type, a.payload)}
            >
              {a.label}
            </button>
          ))}
        </div>
      ) : null}

      {/* ───────────────────────────────────────────── */}
      {/* CREATE ON-CHAIN */}
      {/* ───────────────────────────────────────────── */}
      {!card.on_chain?.claim_id && (
        <button
          className="btn btn-primary"
          style={{ marginTop: 14, width: "100%" }}
        >
          Create claim on-chain
        </button>
      )}

      {/* ───────────────────────────────────────────── */}
      {/* ▲ INCOMING LINKS (this claim is based on others) */}
      {/* ───────────────────────────────────────────── */}
      <div
        style={{
          textAlign: "center",
          marginTop: 14,
        }}
      >
        <button className="btn btn-small" title="Incoming links">
          ▲ Incoming links
        </button>
      </div>
    </div>
  );
}

