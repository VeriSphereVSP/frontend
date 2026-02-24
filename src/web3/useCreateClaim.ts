// frontend/src/web3/useCreateClaim.ts
import { useState, useCallback, useEffect } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { encodeFunctionData, type Address } from "viem";
import { useMetaTx } from "./useMetaTx";
import {
  PostRegistryABI,
  VSPTokenABI,
  FUJI_ADDRESSES,
} from "@verisphere/protocol";

const POSTING_FEE = BigInt("1000000000000000000"); // 1 VSP
const MAX_APPROVAL = BigInt("1000000000000000000000"); // 1000 VSP

function errorToString(err: any): string {
  if (typeof err === "string") return err;
  if (err?.shortMessage) return err.shortMessage;
  if (err?.message) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return "Unknown error";
  }
}

export interface ClaimState {
  post_id: number;
  text: string;
  creator: string;
  support_total: number;
  challenge_total: number;
  user_support: number;
  user_challenge: number;
}

export function useCreateClaim() {
  const { address: userAddress } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { sendMetaTx } = useMetaTx();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [claimState, setClaimState] = useState<ClaimState | null>(null);
  const [needsApproval, setNeedsApproval] = useState(false);

  const checkAllowance = useCallback(async () => {
    if (!userAddress || !publicClient) return;
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
  }, [userAddress, publicClient]);

  useEffect(() => {
    checkAllowance();
  }, [checkAllowance]);

  const approveVSP = useCallback(async () => {
    if (!userAddress || !walletClient) return;
    setLoading(true);
    setError(null);
    try {
      const hash = await walletClient.writeContract({
        address: FUJI_ADDRESSES.VSPToken as Address,
        abi: VSPTokenABI,
        functionName: "approve",
        args: [FUJI_ADDRESSES.PostRegistry as Address, MAX_APPROVAL],
      });
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }
      setNeedsApproval(false);
    } catch (err: any) {
      setError(errorToString(err));
    } finally {
      setLoading(false);
    }
  }, [userAddress, walletClient, publicClient]);

  const createClaim = useCallback(
    async (text: string): Promise<ClaimState | null> => {
      if (!userAddress || !publicClient) {
        setError("Wallet not connected");
        return null;
      }
      setLoading(true);
      setError(null);
      setTxHash(null);
      setClaimState(null);
      try {
        // Pre-flight: check allowance
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

        // Pre-flight: check balance
        const balance = await publicClient.readContract({
          address: FUJI_ADDRESSES.VSPToken as Address,
          abi: VSPTokenABI,
          functionName: "balanceOf",
          args: [userAddress],
        });
        if ((balance as bigint) < POSTING_FEE) {
          setError("Insufficient VSP balance (need 1 VSP to create a claim)");
          return null;
        }

        const calldata = encodeFunctionData({
          abi: PostRegistryABI,
          functionName: "createClaim",
          args: [text],
        });

        // sendMetaTx now returns the full relay response
        const result = await sendMetaTx(
          FUJI_ADDRESSES.PostRegistry as Address,
          calldata,
          { gasLimit: 400_000 },
        );

        setTxHash(result.tx_hash);

        if (result.claim) {
          setClaimState(result.claim);
          return result.claim;
        }

        return null;
      } catch (err: any) {
        setError(errorToString(err));
        console.error("createClaim error:", err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [userAddress, publicClient, sendMetaTx],
  );

  return {
    createClaim,
    approveVSP,
    loading,
    error,
    txHash,
    claimState,
    needsApproval,
  };
}
