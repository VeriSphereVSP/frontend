// frontend/src/web3/useStake.ts
//
// Stake/unstake VSP via gasless meta-transactions.
// Interface matches what ClaimCard.tsx expects:
//   { stake, withdraw, loading, error, txHash }

import { useState, useCallback } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { encodeFunctionData, type Address } from "viem";
import { useMetaTx } from "./useMetaTx";
import {
  StakeEngineABI,
  VSPTokenABI,
  FUJI_ADDRESSES,
} from "@verisphere/protocol";

const VSP_DECIMALS = BigInt(10) ** BigInt(18);
const MAX_APPROVAL = BigInt("1000000000000000000000");

export function useStake() {
  const { address: userAddress } = useAccount();
  const publicClient = usePublicClient();
  const { sendMetaTx } = useMetaTx();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const ensureAllowance = useCallback(
    async (amountWei: bigint) => {
      if (!userAddress || !publicClient) return;
      const currentAllowance = await publicClient.readContract({
        address: FUJI_ADDRESSES.VSPToken as Address,
        abi: VSPTokenABI,
        functionName: "allowance",
        args: [userAddress, FUJI_ADDRESSES.StakeEngine as Address],
      });
      if ((currentAllowance as bigint) < amountWei) {
        const approveData = encodeFunctionData({
          abi: VSPTokenABI,
          functionName: "approve",
          args: [FUJI_ADDRESSES.StakeEngine as Address, MAX_APPROVAL],
        });
        await sendMetaTx(FUJI_ADDRESSES.VSPToken as Address, approveData, {
          gasLimit: 100_000,
        });
        await new Promise((r) => setTimeout(r, 3000));
      }
    },
    [userAddress, publicClient, sendMetaTx],
  );

  const stake = useCallback(
    async (
      postId: number,
      side: "support" | "challenge",
      amount: number,
    ): Promise<string | null> => {
      if (!userAddress) {
        setError("Wallet not connected");
        return null;
      }
      setLoading(true);
      setError(null);
      setTxHash(null);
      try {
        const amountWei = BigInt(amount) * VSP_DECIMALS;
        await ensureAllowance(amountWei);
        const calldata = encodeFunctionData({
          abi: StakeEngineABI,
          functionName: "stake",
          args: [BigInt(postId), side === "support" ? 0 : 1, amountWei],
        });
        const hash = await sendMetaTx(
          FUJI_ADDRESSES.StakeEngine as Address,
          calldata,
          { gasLimit: 400_000 },
        );
        setTxHash(hash);
        return hash;
      } catch (err: any) {
        setError(err?.message || "Stake failed");
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
    ): Promise<string | null> => {
      if (!userAddress) {
        setError("Wallet not connected");
        return null;
      }
      setLoading(true);
      setError(null);
      setTxHash(null);
      try {
        const amountWei = BigInt(amount) * VSP_DECIMALS;
        const calldata = encodeFunctionData({
          abi: StakeEngineABI,
          functionName: "withdraw",
          args: [BigInt(postId), side === "support" ? 0 : 1, amountWei, lifo],
        });
        const hash = await sendMetaTx(
          FUJI_ADDRESSES.StakeEngine as Address,
          calldata,
          { gasLimit: 300_000 },
        );
        setTxHash(hash);
        return hash;
      } catch (err: any) {
        setError(err?.message || "Unstake failed");
        console.error("withdraw error:", err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [userAddress, sendMetaTx],
  );

  return { stake, withdraw, loading, error, txHash };
}
