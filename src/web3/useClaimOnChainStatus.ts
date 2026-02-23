// frontend/src/web3/useClaimOnChainStatus.ts
//
// Hook that checks whether a claim exists on-chain.
// Returns { isOnChain, postId, isLoading } so ClaimCard can:
//   - Show "Create On-Chain" button only when isOnChain === false
//   - Enable stake buttons only when isOnChain === true
//   - Re-check after a createClaim tx succeeds

import { useState, useEffect, useCallback } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

interface ClaimStatus {
  isOnChain: boolean;
  postId: number | null;
  isLoading: boolean;
}

export function useClaimOnChainStatus(
  claimText: string,
): ClaimStatus & { refetch: () => void } {
  const [isOnChain, setIsOnChain] = useState(false);
  const [postId, setPostId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    if (!claimText) {
      setIsOnChain(false);
      setPostId(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/claim-status/${encodeURIComponent(claimText)}`,
      );
      if (!res.ok) {
        setIsOnChain(false);
        setPostId(null);
        return;
      }
      const data = await res.json();
      // The backend returns on_chain info. If the claim has been found
      // on-chain, on_chain will contain match data.
      const found =
        data.on_chain &&
        data.on_chain.post_id !== undefined &&
        data.on_chain.post_id !== null;
      setIsOnChain(found);
      setPostId(found ? data.on_chain.post_id : null);
    } catch (err) {
      console.error("Failed to check claim status:", err);
      setIsOnChain(false);
      setPostId(null);
    } finally {
      setIsLoading(false);
    }
  }, [claimText]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return { isOnChain, postId, isLoading, refetch: fetchStatus };
}
