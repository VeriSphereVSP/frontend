// frontend/src/web3/useCreateClaim.ts
import { useCallback, useMemo, useState } from "react";
import {
  useAccount,
  useContractWrite,
  useWaitForTransactionReceipt,
} from "wagmi";
import { useContracts } from "../contracts";
import { PostRegistryABI } from "@verisphere/protocol/abis";

export function useCreateClaim() {
  const { isConnected } = useAccount();
  const { data: contracts } = useContracts();

  const [localError, setLocalError] = useState<string | null>(null);

  const {
    writeContract,
    data: tx,
    isPending,
    error: writeError,
  } = useContractWrite();

  const {
    isLoading: isConfirming,
    isSuccess,
    error: txError,
  } = useWaitForTransactionReceipt({
    hash: tx?.hash,
  });

  const createClaim = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) {
        setLocalError("Claim text is empty.");
        return;
      }

      if (!isConnected) {
        setLocalError("Connect a wallet first.");
        return;
      }

      const registryAddress = contracts?.PostRegistry;
      if (!registryAddress) {
        setLocalError("PostRegistry address not yet available.");
        return;
      }

      setLocalError(null);

      try {
        writeContract({
          address: registryAddress,
          abi: PostRegistryABI,
          functionName: "createPost",
          args: [trimmed],
        });
      } catch (err: any) {
        setLocalError(
          err?.shortMessage || err?.message || "Failed to send transaction."
        );
      }
    },
    [contracts, isConnected, writeContract]
  );

  const error = useMemo(() => {
    if (localError) return localError;
    if (writeError)
      return (writeError as any).shortMessage || writeError.message;
    if (txError) return (txError as any).shortMessage || txError.message;
    return null;
  }, [localError, writeError, txError]);

  return {
    createClaim,
    isPending: isPending || isConfirming,
    isSuccess,
    txHash: tx?.hash,
    error,
  };
}

