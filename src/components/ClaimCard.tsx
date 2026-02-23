// frontend/src/components/ClaimCard.tsx
import { useState, useEffect, useCallback } from "react";
import type { ClaimCard as ClaimCardT } from "../types";
import { useAccount } from "wagmi";
import { useCreateClaim } from "../web3/useCreateClaim";
import { useStake } from "../web3/useStake";
import StakeModal from "./StakeModal";

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

function getBackgroundColor(vs: number): string {
  if (vs > 0) return `rgba(0, 200, 80, ${Math.min(0.35, (vs / 100) * 0.35)})`;
  if (vs < 0)
    return `rgba(220, 50, 50, ${Math.min(0.35, (Math.abs(vs) / 100) * 0.35)})`;
  return "transparent";
}

export default function ClaimCard({
  card,
  onOpenModal,
}: {
  card: ClaimCardT;
  onOpenModal?: () => void;
}) {
  const { isConnected } = useAccount();

  const {
    createClaim,
    approveVSP,
    loading: createLoading,
    error: createError,
    txHash: createTxHash,
    needsApproval,
  } = useCreateClaim();

  const {
    stake,
    loading: stakeLoading,
    error: stakeError,
    txHash: stakeTxHash,
  } = useStake();

  const [showStakeModal, setShowStakeModal] = useState<
    "support" | "challenge" | null
  >(null);

  // ---- On-chain status tracking ----
  // Start from the card prop's on_chain data
  const [onChainData, setOnChainData] = useState(card.on_chain);
  const [justCreated, setJustCreated] = useState(false);

  // Sync from prop when it changes (e.g. parent re-fetches)
  useEffect(() => {
    if (card.on_chain) {
      setOnChainData(card.on_chain);
    }
  }, [card.on_chain]);

  // After a successful create, poll the backend until claim appears on-chain
  const pollClaimStatus = useCallback(async () => {
    if (!card.text) return;

    const maxAttempts = 10;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      try {
        const res = await fetch(
          `${API_BASE}/claim-status/${encodeURIComponent(card.text)}`,
        );
        if (!res.ok) continue;
        const data = await res.json();
        if (data.on_chain && data.on_chain.post_id != null) {
          // Claim is now on-chain — update local state
          setOnChainData({
            ...data.on_chain,
            claim_id: data.on_chain.post_id,
            stake: data.on_chain.stake || { support: 0, challenge: 0 },
            eVS: data.on_chain.eVS ?? 0,
            links: data.on_chain.links || { outgoing: 0, incoming: 0 },
          });
          return;
        }
      } catch {
        // ignore, try again
      }
    }
  }, [card.text]);

  // When createTxHash arrives, start polling
  useEffect(() => {
    if (createTxHash && !justCreated) {
      setJustCreated(true);
      pollClaimStatus();
    }
  }, [createTxHash, justCreated, pollClaimStatus]);

  // ---- Derived state ----
  // A claim is "on-chain" if we have a claim_id (either from prop or from polling)
  const claimId = onChainData?.claim_id ?? onChainData?.post_id ?? null;
  const isOnChain = claimId != null;

  const vs = onChainData?.eVS ?? card.verity_score ?? 0;
  const support = onChainData?.stake?.support ?? card.stake_support ?? 0;
  const challenge = onChainData?.stake?.challenge ?? card.stake_challenge ?? 0;
  const totalStake = support + challenge;
  const supportPct = totalStake > 0 ? (support / totalStake) * 100 : 0;
  const challengePct = totalStake > 0 ? (challenge / totalStake) * 100 : 0;
  const outgoingLinks = onChainData?.links?.outgoing ?? 0;
  const incomingLinks = onChainData?.links?.incoming ?? 0;

  const handleStake = async (amount: number) => {
    if (!showStakeModal || claimId == null) return;
    await stake(claimId, showStakeModal, amount);
    setShowStakeModal(null);
  };

  return (
    <div className="card claim-card">
      <div style={{ textAlign: "center", marginBottom: 12 }}>
        <button
          className="btn btn-small"
          title="Links from this claim"
          disabled={!isOnChain}
        >
          ↑ {outgoingLinks} outbound
        </button>
      </div>

      <p
        style={{
          backgroundColor: getBackgroundColor(vs),
          padding: "12px",
          borderRadius: 10,
          marginBottom: 24,
        }}
      >
        {card.text}
      </p>

      <div className="queues">
        <div
          className={`gauge-container${!isOnChain ? " disabled-gauge" : ""}`}
          onClick={() =>
            isOnChain && isConnected && setShowStakeModal("support")
          }
          title={
            isOnChain ? "Click to stake support" : "Claim not yet on-chain"
          }
        >
          <div
            className="gauge-fill green"
            style={{ height: `${supportPct}%` }}
          />
          <div className="gauge-label">
            Support
            <br />
            <strong>{support.toFixed(0)}</strong>
          </div>
        </div>

        <div
          className={`gauge-container${!isOnChain ? " disabled-gauge" : ""}`}
          onClick={() =>
            isOnChain && isConnected && setShowStakeModal("challenge")
          }
          title={
            isOnChain ? "Click to stake challenge" : "Claim not yet on-chain"
          }
        >
          <div
            className="gauge-fill red"
            style={{ height: `${challengePct}%` }}
          />
          <div className="gauge-label">
            Challenge
            <br />
            <strong>{challenge.toFixed(0)}</strong>
          </div>
        </div>
      </div>

      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <span className="badge">
          Verity Score:{" "}
          <strong
            style={{ color: vs > 0 ? "#00aa44" : vs < 0 ? "#cc2222" : "#888" }}
          >
            {vs > 0 ? "+" : ""}
            {vs.toFixed(1)}
          </strong>
        </span>
      </div>

      {card.author && (
        <div
          style={{
            textAlign: "center",
            marginBottom: 20,
            fontSize: 13,
            color: "#666",
          }}
        >
          by {card.author}
        </div>
      )}

      <div className="actions">
        {/* Show Create button ONLY when claim is NOT on-chain */}
        {!isOnChain &&
          !justCreated &&
          (isConnected ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {needsApproval && (
                <button
                  className="btn btn-warning"
                  onClick={approveVSP}
                  disabled={createLoading}
                >
                  {createLoading ? "Approving…" : "Approve VSP"}
                </button>
              )}
              <button
                className="btn btn-primary"
                onClick={() => createClaim(card.text)}
                disabled={createLoading || needsApproval}
              >
                {createLoading ? "Creating…" : "Create On-Chain"}
              </button>
            </div>
          ) : (
            <div className="connect-warning">
              Connect a wallet to create and stake this claim.
            </div>
          ))}

        {/* Show "confirming" state after create tx sent but before on-chain confirmed */}
        {justCreated && !isOnChain && (
          <div style={{ textAlign: "center", fontSize: 13, color: "#888" }}>
            Confirming on-chain…
          </div>
        )}

        {/* Show stake instructions when claim IS on-chain */}
        {isOnChain && !isConnected && (
          <div className="connect-warning">
            Connect a wallet to stake on this claim.
          </div>
        )}

        {isOnChain && isConnected && (
          <div style={{ textAlign: "center", fontSize: 13, color: "#555" }}>
            Click a queue above to stake
          </div>
        )}

        <div style={{ textAlign: "center" }}>
          <button
            className="btn btn-small"
            title="Links to this claim"
            disabled={!isOnChain}
          >
            ↑ {incomingLinks} inbound
          </button>
        </div>
      </div>

      {createError && (
        <div className="error" style={{ marginTop: 12 }}>
          {createError}
        </div>
      )}
      {stakeError && (
        <div className="error" style={{ marginTop: 12 }}>
          {stakeError}
        </div>
      )}
      {createTxHash && (
        <div className="success" style={{ marginTop: 12 }}>
          ✓ Claim created! Tx: {createTxHash.slice(0, 12)}…
        </div>
      )}
      {stakeTxHash && (
        <div className="success" style={{ marginTop: 12 }}>
          ✓ Stake submitted! Tx: {stakeTxHash.slice(0, 12)}…
        </div>
      )}

      {showStakeModal && isOnChain && claimId != null && (
        <StakeModal
          claimId={claimId}
          side={showStakeModal}
          onClose={() => setShowStakeModal(null)}
          onStake={handleStake}
        />
      )}
    </div>
  );
}
