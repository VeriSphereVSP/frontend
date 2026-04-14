// frontend/src/components/article/InlineClaimCard.tsx
// Thin wrapper around shared ExpandedClaimDetail.
// Handles the Explorer-specific "create claim from sentence" flow when postId is null.
import { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import { useCreateClaim, useStake } from "@verisphere/protocol";
import { friendlyError, fireToast } from "../../utils/errorMessages";
import { fireTxProgress } from "./TxProgress";
import { S, ExpandedClaimDetail } from "../claims-shared";
import StakeInput from "./StakeInput";
import type { Sentence } from "./types";

const MAX_CLAIM_LENGTH = 500;
const API = import.meta.env.VITE_API_BASE || "/api";

const triggerReindex = async (postId: number, userAddr?: string) => {
  try {
    const params = userAddr ? `?user=${userAddr}` : "";
    await fetch(`${API}/reindex/${postId}${params}`, { method: "POST" });
  } catch { /* non-fatal */ }
};

/* ── Create-claim prompt — shown when a sentence has no post_id yet ── */
function CreateClaimPrompt({
  text,
  onCreated,
  onClose,
}: {
  text: string;
  onCreated: (newPid: number) => void;
  onClose?: () => void;
}) {
  const { isConnected, address } = useAccount();
  const [amount, setAmount] = useState(1);
  const { createClaim, loading, needsApproval, approveVSP, error } = useCreateClaim();
  const { stake: stakeOnClaim } = useStake();

  const tooLong = text.length > MAX_CLAIM_LENGTH;

  const handleCreate = useCallback(async () => {
    if (!isConnected || tooLong || amount <= 0) return;
    try {
      fireTxProgress({ title: "Creating claim", stage: "signing" });
      if (needsApproval) {
        await approveVSP();
      }
      const result = await createClaim(text);
      if (result?.post_id != null) {
        // If user entered a stake, submit it
        if (amount > 0) {
          fireTxProgress({ title: "Creating claim", stage: "staking" });
          try {
            await stakeOnClaim(result.post_id, 0, amount);
          } catch (stakeErr: any) {
            // Claim was created but staking failed — still notify parent
            console.warn("Stake after createClaim failed:", stakeErr);
          }
        }
        fireTxProgress({ title: "Creating claim", stage: "confirmed" });
        if (address) await triggerReindex(result.post_id, address);
        onCreated(result.post_id);
      } else {
        fireTxProgress({ title: "Creating claim", stage: "confirmed" });
      }
    } catch (e: any) {
      fireTxProgress({ title: "Creating claim", stage: "error" });
      fireToast(friendlyError(e));
    }
  }, [isConnected, tooLong, amount, needsApproval, approveVSP, createClaim, text, address, onCreated, stakeOnClaim]);

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        margin: "4px 0",
        padding: "10px 12px",
        background: "#fff",
        border: `1px solid ${S.border}`,
        borderRadius: 6,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: S.textMuted }}>
          Make this a claim on-chain?
        </span>
        <StakeInput value={amount} onChange={setAmount} />
        <span style={{ fontSize: 10, color: S.textFaint }}>VSP (support)</span>
        <button
          onClick={handleCreate}
          disabled={!isConnected || tooLong || amount <= 0 || loading}
          style={{
            padding: "4px 10px",
            fontSize: 11,
            borderRadius: 4,
            border: "none",
            background: S.blue,
            color: "#fff",
            cursor: isConnected && !tooLong ? "pointer" : "not-allowed",
            opacity: isConnected && !tooLong && amount > 0 && !loading ? 1 : 0.5,
          }}
        >
          {loading ? "Creating…" : needsApproval ? "Approve & Create" : "Create claim"}
        </button>
        {onClose && (
          <span
            onClick={onClose}
            style={{ cursor: "pointer", fontSize: 13, color: S.textFaint, marginLeft: "auto" }}
          >✕</span>
        )}
      </div>
      {tooLong && (
        <div style={{ fontSize: 10, color: S.red, marginTop: 4 }}>
          Claim too long ({text.length} / {MAX_CLAIM_LENGTH})
        </div>
      )}
      {error && (
        <div style={{ fontSize: 10, color: S.red, marginTop: 4 }}>
          {friendlyError(error)}
        </div>
      )}
    </div>
  );
}

/* ── Main component ── */
export default function InlineClaimCard({
  postId,
  text,
  stakeSupport,
  stakeChallenge,
  verityScore,
  sentenceId,
  allSentences,
  onRefresh,
  onClose,
  linksOnly,
  postType,
}: {
  postId: number | null;
  text: string;
  stakeSupport: number;
  stakeChallenge: number;
  verityScore: number;
  postType?: "claim" | "link";
  sentenceId?: number;
  allSentences?: Sentence[];
  onRefresh: () => void;
  onClose?: () => void;
  linksOnly?: boolean;
}) {
  const { address } = useAccount();
  const [resolvedPid, setResolvedPid] = useState<number | null>(postId);

  // Resolve postId from sentence id / text match if needed
  useEffect(() => {
    if (postId != null) {
      setResolvedPid(postId);
      return;
    }
    // Try to find matching claim in allSentences
    if (allSentences && sentenceId != null) {
      const match = allSentences.find(
        (s) => s.sentence_id === sentenceId && s.post_id != null
      );
      if (match?.post_id) {
        setResolvedPid(match.post_id);
        return;
      }
    }
    // Try by text match
    if (allSentences) {
      const match = allSentences.find(
        (s) => s.post_id != null && s.text.trim() === text.trim()
      );
      if (match?.post_id) {
        setResolvedPid(match.post_id);
      }
    }
  }, [postId, text, sentenceId, allSentences]);

  // Case 1: Sentence has no claim yet — show create-claim prompt
  if (resolvedPid == null) {
    return (
      <CreateClaimPrompt
        text={text}
        onCreated={(newPid) => {
          setResolvedPid(newPid);
          onRefresh();
        }}
        onClose={onClose}
      />
    );
  }

  // Case 2: Claim exists — delegate to shared ExpandedClaimDetail
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        margin: "4px 0",
        padding: "8px 12px",
        background: "#fff",
        border: `1px solid ${S.border}`,
        borderRadius: 6,
      }}
    >
      <ExpandedClaimDetail
        claim={{
          post_id: resolvedPid,
          text,
          verity_score: verityScore,
          base_vs: verityScore,
          stake_support: stakeSupport,
          stake_challenge: stakeChallenge,
          total_stake: stakeSupport + stakeChallenge,
          controversy: 0,
          incoming_links: 0,
          outgoing_links: 0,
          topic: "",
          created_at: null,
          created_epoch: undefined,
          is_link: postType === "link",
        }}
        onRefresh={onRefresh}
        onClose={onClose}
        hideStaking={linksOnly}
      />
    </div>
  );
}
