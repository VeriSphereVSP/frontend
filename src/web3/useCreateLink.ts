// frontend/src/web3/useCreateLink.ts
import { useState, useCallback } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { encodeFunctionData, type Address } from "viem";
import { useMetaTx } from "./useMetaTx";
import {
  PostRegistryABI,
  VSPTokenABI,
  FUJI_ADDRESSES,
} from "@verisphere/protocol";

const POSTING_FEE = BigInt("1000000000000000000");
const MAX_APPROVAL = BigInt("1000000000000000000000");

export function useCreateLink() {
  const { address: userAddress } = useAccount();
  const publicClient = usePublicClient();
  const { sendMetaTx } = useMetaTx();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createLink = useCallback(
    async (
      independentPostId: number,
      dependentPostId: number,
      isChallenge: boolean,
    ): Promise<string | null> => {
      if (!userAddress || !publicClient) {
        setError("Wallet not connected");
        return null;
      }
      setIsLoading(true);
      setError(null);
      try {
        const currentAllowance = await publicClient.readContract({
          address: FUJI_ADDRESSES.VSPToken as Address,
          abi: VSPTokenABI,
          functionName: "allowance",
          args: [userAddress, FUJI_ADDRESSES.PostRegistry as Address],
        });
        if ((currentAllowance as bigint) < POSTING_FEE) {
          const approveData = encodeFunctionData({
            abi: VSPTokenABI,
            functionName: "approve",
            args: [FUJI_ADDRESSES.PostRegistry as Address, MAX_APPROVAL],
          });
          await sendMetaTx(FUJI_ADDRESSES.VSPToken as Address, approveData, {
            gasLimit: 100_000,
          });
          await new Promise((r) => setTimeout(r, 3000));
        }
        const calldata = encodeFunctionData({
          abi: PostRegistryABI,
          functionName: "createLink",
          args: [
            BigInt(independentPostId),
            BigInt(dependentPostId),
            isChallenge,
          ],
        });
        return await sendMetaTx(
          FUJI_ADDRESSES.PostRegistry as Address,
          calldata,
          { gasLimit: 500_000 },
        );
      } catch (err: any) {
        setError(err?.message || "Failed to create link");
        console.error("createLink error:", err);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [userAddress, publicClient, sendMetaTx],
  );

  return { createLink, isLoading, error };
}
