// frontend/src/components/ClaimCard.tsx
import { useState, useEffect, useCallback } from "react";
import type { ClaimCard as ClaimCardT } from "../types";
import { useAccount } from "wagmi";
import { useCreateClaim, type ClaimState } from "../web3/useCreateClaim";
import { useStake } from "../web3/useStake";

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

// Module-level set: tracks claims created this session (survives remount)
const createdClaimsThisSession = new Set<string>();

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
  const { isConnected, address: userAddress } = useAccount();

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
    withdraw,
    loading: stakeLoading,
    error: stakeError,
    txHash: stakeTxHash,
  } = useStake();

  // Authoritative chain state — updated from relay responses AND from fetch
  const [chainState, setChainState] = useState<ClaimState | null>(null);
  const [verityScore, setVerityScore] = useState<number>(
    card.verity_score ?? 0,
  );
  const [fetchedOnMount, setFetchedOnMount] = useState(false);
  const [justCreated, setJustCreated] = useState(
    createdClaimsThisSession.has(card.text),
  );

  // Staking UI state
  const [stakeAmount, setStakeAmount] = useState("1");
  const [stakeSide, setStakeSide] = useState<"support" | "challenge">(
    "support",
  );

  // Fetch full claim state from backend on mount
  const fetchClaimState = useCallback(async () => {
    try {
      const url = `${API_BASE}/claim-status/${encodeURIComponent(card.text)}${
        userAddress ? `?user=${userAddress}` : ""
      }`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();

      if (data.on_chain?.post_id != null) {
        setChainState({
          post_id: data.on_chain.post_id,
          text: card.text,
          creator: data.on_chain.creator || "",
          support_total: data.stake_support ?? 0,
          challenge_total: data.stake_challenge ?? 0,
          user_support: data.user_support ?? 0,
          user_challenge: data.user_challenge ?? 0,
        });
        createdClaimsThisSession.add(card.text);
      }
      if (data.verity_score != null) {
        setVerityScore(data.verity_score);
      }
    } catch (e) {
      console.warn("Failed to fetch claim state:", e);
    } finally {
      setFetchedOnMount(true);
    }
  }, [card.text, userAddress]);

  useEffect(() => {
    fetchClaimState();
  }, [fetchClaimState]);

  // Derive display state
  const claimIsOnChain = chainState != null && chainState.post_id != null;
  const postId = chainState?.post_id ?? null;

  // Treat dust amounts (< 0.001 VSP) as zero for display
  const DUST = 0.001;
  const support =
    (chainState?.support_total ?? 0) < DUST
      ? 0
      : (chainState?.support_total ?? 0);
  const challenge =
    (chainState?.challenge_total ?? 0) < DUST
      ? 0
      : (chainState?.challenge_total ?? 0);
  const userSupport =
    (chainState?.user_support ?? 0) < DUST
      ? 0
      : (chainState?.user_support ?? 0);
  const userChallenge =
    (chainState?.user_challenge ?? 0) < DUST
      ? 0
      : (chainState?.user_challenge ?? 0);
  const totalStake = support + challenge;
  const supportPct = totalStake > 0 ? (support / totalStake) * 100 : 0;
  const challengePct = totalStake > 0 ? (challenge / totalStake) * 100 : 0;
  const vs = verityScore;

  // Show Create button only if:
  // - fetched from backend (to avoid flash)
  // - not on chain
  // - not just created in this session
  // - not currently in the process of creating
  const showCreateButton =
    fetchedOnMount && !claimIsOnChain && !justCreated && !createLoading;
  const showConfirming = justCreated && !claimIsOnChain;
  const canStake = claimIsOnChain && isConnected && postId != null;

  // Handlers
  const handleCreate = async () => {
    // Immediately mark as created to prevent double-click and hide Create button
    setJustCreated(true);
    createdClaimsThisSession.add(card.text);

    const result = await createClaim(card.text);
    if (result) {
      // Relay returned full state — use it directly
      setChainState(result);
      fetchClaimState();
    } else {
      // Create failed — undo the optimistic mark
      setJustCreated(false);
      createdClaimsThisSession.delete(card.text);
    }
  };

  const handleStake = async () => {
    if (postId == null) return;
    const amt = parseFloat(stakeAmount);
    if (isNaN(amt) || amt <= 0) return;
    const result = await stake(postId, stakeSide, amt);
    if (result) {
      setChainState(result);
      // Re-fetch to get updated verity score
      fetchClaimState();
    }
  };

  const handleUnstake = async () => {
    if (postId == null) return;
    const amt = parseFloat(stakeAmount);
    if (isNaN(amt) || amt <= 0) return;
    const result = await withdraw(postId, stakeSide, amt);
    if (result) {
      setChainState(result);
      fetchClaimState();
    }
  };

  const myStakeOnSide = stakeSide === "support" ? userSupport : userChallenge;

  return (
    <div className="card claim-card">
      <div style={{ textAlign: "center", marginBottom: 12 }}>
        <button className="btn btn-small" disabled={!claimIsOnChain}>
          ↑ 0 outbound
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

      {/* Stake gauges */}
      <div className="queues">
        <div
          className={`gauge-container${
            !claimIsOnChain
              ? " disabled-gauge"
              : stakeSide === "support"
                ? " selected-gauge"
                : ""
          }`}
          onClick={() => canStake && setStakeSide("support")}
          style={{ cursor: canStake ? "pointer" : "default" }}
        >
          {supportPct > 0 && (
            <div
              className="gauge-fill green"
              style={{ height: `${supportPct}%` }}
            />
          )}
          <div className="gauge-label">
            Support
            <br />
            <strong>{support.toFixed(1)}</strong>
            {userSupport > 0 && (
              <>
                <br />
                <span style={{ fontSize: 11, color: "#00aa44" }}>
                  You: {userSupport.toFixed(2)}
                </span>
              </>
            )}
          </div>
        </div>

        <div
          className={`gauge-container${
            !claimIsOnChain
              ? " disabled-gauge"
              : stakeSide === "challenge"
                ? " selected-gauge"
                : ""
          }`}
          onClick={() => canStake && setStakeSide("challenge")}
          style={{ cursor: canStake ? "pointer" : "default" }}
        >
          {challengePct > 0 && (
            <div
              className="gauge-fill red"
              style={{ height: `${challengePct}%` }}
            />
          )}
          <div className="gauge-label">
            Challenge
            <br />
            <strong>{challenge.toFixed(1)}</strong>
            {userChallenge > 0 && (
              <>
                <br />
                <span style={{ fontSize: 11, color: "#cc2222" }}>
                  You: {userChallenge.toFixed(2)}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <span className="badge">
          Verity Score:{" "}
          <strong
            style={{
              color: vs > 0 ? "#00aa44" : vs < 0 ? "#cc2222" : "#888",
            }}
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
            marginBottom: 12,
            fontSize: 13,
            color: "#666",
          }}
        >
          by {card.author}
        </div>
      )}

      {/* ---- Actions ---- */}
      <div className="actions">
        {/* CREATE SECTION */}
        {showCreateButton &&
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
                onClick={handleCreate}
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

        {/* CONFIRMING (only while waiting for relay response) */}
        {showConfirming && !createError && (
          <div style={{ textAlign: "center", fontSize: 13, color: "#888" }}>
            {createLoading ? "Creating on-chain…" : "✓ Created — confirming…"}
          </div>
        )}

        {/* INLINE STAKING SECTION */}
        {canStake && (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              border: "1px solid #e0e0e0",
              borderRadius: 8,
              backgroundColor: "#fafafa",
            }}
          >
            <div
              style={{
                textAlign: "center",
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 8,
              }}
            >
              {stakeSide === "support" ? "Support" : "Challenge"} this claim
            </div>

            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <input
                type="number"
                min="0.01"
                step="0.1"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
                style={{
                  flex: 1,
                  padding: "6px 10px",
                  border: "1px solid #ccc",
                  borderRadius: 6,
                  fontSize: 14,
                }}
                placeholder="VSP amount"
              />
              <span style={{ fontSize: 13, color: "#666" }}>VSP</span>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button
                className="btn btn-primary"
                onClick={handleStake}
                disabled={stakeLoading}
                style={{ flex: "0 1 160px" }}
              >
                {stakeLoading ? "Staking…" : `Stake ${stakeSide}`}
              </button>

              <button
                className="btn"
                onClick={handleUnstake}
                disabled={stakeLoading || myStakeOnSide <= 0}
                style={{
                  flex: "0 1 160px",
                  backgroundColor: myStakeOnSide > 0 ? "#fee" : "#f5f5f5",
                  color: myStakeOnSide > 0 ? "#c00" : "#999",
                  border: `1px solid ${myStakeOnSide > 0 ? "#fcc" : "#ddd"}`,
                }}
              >
                {stakeLoading ? "Unstaking…" : "Unstake"}
              </button>
            </div>

            {myStakeOnSide > 0 && (
              <div
                style={{
                  fontSize: 12,
                  color: "#666",
                  textAlign: "center",
                  marginTop: 6,
                }}
              >
                Your {stakeSide} stake: {myStakeOnSide.toFixed(2)} VSP
              </div>
            )}
          </div>
        )}

        {claimIsOnChain && !isConnected && (
          <div className="connect-warning">
            Connect a wallet to stake on this claim.
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: 8 }}>
          <button className="btn btn-small" disabled={!claimIsOnChain}>
            ↑ 0 inbound
          </button>
        </div>
      </div>

      {/* Status messages */}
      {createError && (
        <div className="error" style={{ marginTop: 12 }}>
          {typeof createError === "string"
            ? createError
            : JSON.stringify(createError)}
        </div>
      )}
      {stakeError && (
        <div className="error" style={{ marginTop: 12 }}>
          {typeof stakeError === "string"
            ? stakeError
            : JSON.stringify(stakeError)}
        </div>
      )}
      {createTxHash && (
        <div className="success" style={{ marginTop: 12 }}>
          ✓ Claim created! Tx: {createTxHash.slice(0, 12)}…
        </div>
      )}
      {stakeTxHash && (
        <div className="success" style={{ marginTop: 12 }}>
          ✓ Stake updated! Tx: {stakeTxHash.slice(0, 12)}…
        </div>
      )}
    </div>
  );
}
