// frontend/src/web3/useCreateClaim.ts
//
// Creates a claim on-chain via gasless meta-transaction.
// Maintains the same interface that ClaimCard.tsx expects:
//   { createClaim, approveVSP, loading, error, txHash, needsApproval }

import { useState, useCallback, useEffect } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { encodeFunctionData, type Address } from "viem";
import { useMetaTx } from "./useMetaTx";
import {
  PostRegistryABI,
  VSPTokenABI,
  FUJI_ADDRESSES,
} from "@verisphere/protocol";

const POSTING_FEE = BigInt("1000000000000000000"); // 1 VSP
const MAX_APPROVAL = BigInt("1000000000000000000000"); // 1000 VSP

export function useCreateClaim() {
  const { address: userAddress } = useAccount();
  const publicClient = usePublicClient();
  const { sendMetaTx } = useMetaTx();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [needsApproval, setNeedsApproval] = useState(false);

  // Check allowance on mount and when user changes
  useEffect(() => {
    if (!userAddress || !publicClient) return;

    (async () => {
      try {
        const currentAllowance = await publicClient.readContract({
          address: FUJI_ADDRESSES.VSPToken as Address,
          abi: VSPTokenABI,
          functionName: "allowance",
          args: [userAddress, FUJI_ADDRESSES.PostRegistry as Address],
        });
        setNeedsApproval((currentAllowance as bigint) < POSTING_FEE);
      } catch {
        setNeedsApproval(false);
      }
    })();
  }, [userAddress, publicClient]);

  const approveVSP = useCallback(async () => {
    if (!userAddress || !publicClient) return;
    setLoading(true);
    setError(null);
    try {
      const approveData = encodeFunctionData({
        abi: VSPTokenABI,
        functionName: "approve",
        args: [FUJI_ADDRESSES.PostRegistry as Address, MAX_APPROVAL],
      });
      await sendMetaTx(FUJI_ADDRESSES.VSPToken as Address, approveData, {
        gasLimit: 100_000,
      });
      await new Promise((r) => setTimeout(r, 4000));
      setNeedsApproval(false);
    } catch (err: any) {
      setError(err?.message || "Approval failed");
    } finally {
      setLoading(false);
    }
  }, [userAddress, publicClient, sendMetaTx]);

  const createClaim = useCallback(
    async (text: string): Promise<string | null> => {
      if (!userAddress || !publicClient) {
        setError("Wallet not connected");
        return null;
      }
      setLoading(true);
      setError(null);
      setTxHash(null);
      try {
        const currentAllowance = await publicClient.readContract({
          address: FUJI_ADDRESSES.VSPToken as Address,
          abi: VSPTokenABI,
          functionName: "allowance",
          args: [userAddress, FUJI_ADDRESSES.PostRegistry as Address],
        });
        if ((currentAllowance as bigint) < POSTING_FEE) {
          setNeedsApproval(true);
          setError("Please approve VSP first");
          return null;
        }

        const createClaimData = encodeFunctionData({
          abi: PostRegistryABI,
          functionName: "createClaim",
          args: [text],
        });
        const hash = await sendMetaTx(
          FUJI_ADDRESSES.PostRegistry as Address,
          createClaimData,
          { gasLimit: 400_000 },
        );
        setTxHash(hash);
        return hash;
      } catch (err: any) {
        setError(err?.message || "Failed to create claim");
        console.error("createClaim error:", err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [userAddress, publicClient, sendMetaTx],
  );

  return { createClaim, approveVSP, loading, error, txHash, needsApproval };
}
