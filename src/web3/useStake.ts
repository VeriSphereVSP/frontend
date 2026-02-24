// frontend/src/web3/useStake.ts
import { useState, useCallback } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { encodeFunctionData, parseUnits, type Address } from "viem";
import { useMetaTx } from "./useMetaTx";
import {
  StakeEngineABI,
  VSPTokenABI,
  FUJI_ADDRESSES,
} from "@verisphere/protocol";
import type { ClaimState } from "./useCreateClaim";

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

export function useStake() {
  const { address: userAddress } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { sendMetaTx } = useMetaTx();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [claimState, setClaimState] = useState<ClaimState | null>(null);

  const ensureAllowance = useCallback(
    async (amountWei: bigint) => {
      if (!userAddress || !publicClient || !walletClient) return;
      const currentAllowance = await publicClient.readContract({
        address: FUJI_ADDRESSES.VSPToken as Address,
        abi: VSPTokenABI,
        functionName: "allowance",
        args: [userAddress, FUJI_ADDRESSES.StakeEngine as Address],
      });
      if ((currentAllowance as bigint) < amountWei) {
        const hash = await walletClient.writeContract({
          address: FUJI_ADDRESSES.VSPToken as Address,
          abi: VSPTokenABI,
          functionName: "approve",
          args: [FUJI_ADDRESSES.StakeEngine as Address, MAX_APPROVAL],
        });
        await publicClient.waitForTransactionReceipt({ hash });
      }
    },
    [userAddress, publicClient, walletClient],
  );

  const stake = useCallback(
    async (
      postId: number,
      side: "support" | "challenge",
      amount: number,
    ): Promise<ClaimState | null> => {
      if (!userAddress) {
        setError("Wallet not connected");
        return null;
      }
      setLoading(true);
      setError(null);
      setTxHash(null);
      setClaimState(null);
      try {
        const amountWei = parseUnits(amount.toString(), 18);
        if (amountWei <= 0n) {
          setError("Amount must be greater than 0");
          return null;
        }

        await ensureAllowance(amountWei);

        const calldata = encodeFunctionData({
          abi: StakeEngineABI,
          functionName: "stake",
          args: [BigInt(postId), side === "support" ? 0 : 1, amountWei],
        });

        const result = await sendMetaTx(
          FUJI_ADDRESSES.StakeEngine as Address,
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
        console.error("stake error:", err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [userAddress, sendMetaTx, ensureAllowance],
  );

  const withdraw = useCallback(
    async (
      postId: number,
      side: "support" | "challenge",
      amount: number,
      lifo = true,
    ): Promise<ClaimState | null> => {
      if (!userAddress) {
        setError("Wallet not connected");
        return null;
      }
      setLoading(true);
      setError(null);
      setTxHash(null);
      setClaimState(null);
      try {
        const amountWei = parseUnits(amount.toString(), 18);
        if (amountWei <= 0n) {
          setError("Amount must be greater than 0");
          return null;
        }

        const calldata = encodeFunctionData({
          abi: StakeEngineABI,
          functionName: "withdraw",
          args: [BigInt(postId), side === "support" ? 0 : 1, amountWei, lifo],
        });

        const result = await sendMetaTx(
          FUJI_ADDRESSES.StakeEngine as Address,
          calldata,
          { gasLimit: 300_000 },
        );

        setTxHash(result.tx_hash);
        if (result.claim) {
          setClaimState(result.claim);
          return result.claim;
        }
        return null;
      } catch (err: any) {
        setError(errorToString(err));
        console.error("withdraw error:", err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [userAddress, sendMetaTx],
  );

  return { stake, withdraw, loading, error, txHash, claimState };
}
