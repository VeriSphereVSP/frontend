// frontend/src/web3/useCreateClaim.ts
import { useState, useCallback } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { encodeFunctionData, type Address } from "viem";
import { useMetaTx, type RelayResponse } from "./useMetaTx";
import { signPermit } from "./signPermit";
import {
  PostRegistryABI,
  VSPTokenABI,
  FUJI_ADDRESSES,
} from "@verisphere/protocol";

const POSTING_FEE = BigInt("1000000000000000000"); // 1 VSP
const PERMIT_VALUE = BigInt("10000000000000000000"); // 10 VSP buffer

export type ClaimState = {
  post_id: number;
  text: string;
  creator: string;
  support_total: number;
  challenge_total: number;
  user_support?: number;
  user_challenge?: number;
};

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

export function useCreateClaim() {
  const { address: userAddress, chain } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { sendMetaTx } = useMetaTx();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [claimState, setClaimState] = useState<ClaimState | null>(null);

  const getPermitIfNeeded = useCallback(async () => {
    if (!userAddress || !publicClient || !walletClient || !chain)
      return undefined;
    const currentAllowance = await publicClient.readContract({
      address: FUJI_ADDRESSES.VSPToken as Address,
      abi: VSPTokenABI,
      functionName: "allowance",
      args: [userAddress, FUJI_ADDRESSES.PostRegistry as Address],
    });
    if ((currentAllowance as bigint) >= POSTING_FEE) return undefined;
    return signPermit({
      walletClient,
      publicClient,
      tokenAddress: FUJI_ADDRESSES.VSPToken as Address,
      tokenName: "VeriSphere",
      tokenVersion: "1",
      spender: FUJI_ADDRESSES.PostRegistry as Address,
      value: PERMIT_VALUE,
      chainId: chain.id,
    });
  }, [userAddress, publicClient, walletClient, chain]);

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
        // Check balance
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

        // Get permit if allowance is insufficient
        const permit = await getPermitIfNeeded();

        // Encode createClaim calldata
        const calldata = encodeFunctionData({
          abi: PostRegistryABI,
          functionName: "createClaim",
          args: [text],
        });

        // Send meta-tx with optional permit
        const result: RelayResponse = await sendMetaTx(
          FUJI_ADDRESSES.PostRegistry as Address,
          calldata,
          { gasLimit: 600_000, permit },
        );

        setTxHash(result.tx_hash);
        if (result.claim) {
          setClaimState(result.claim);
          return result.claim;
        }

        // If relay returned ok but no claim data, try to extract post_id
        if (result.ok && result.tx_hash) {
          return {
            post_id: -1,
            text,
            creator: userAddress,
            support_total: 0,
            challenge_total: 0,
          };
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
    [userAddress, publicClient, sendMetaTx, getPermitIfNeeded],
  );

  return {
    createClaim,
    loading,
    error,
    txHash,
    claimState,
    needsApproval: false,
    approveVSP: async () => {},
  };
}
