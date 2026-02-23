// frontend/src/web3/useMetaTx.ts
import { useCallback } from "react";
import { useWalletClient } from "wagmi";
import { type Hex, type Address } from "viem";
import { FUJI_ADDRESSES } from "@verisphere/protocol";

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

// EIP-712 domain — name MUST match the constructor string in VerisphereForwarder.sol
const FORWARDER_DOMAIN = {
  name: "VerisphereForwarder",
  version: "1",
  chainId: 43113,
  verifyingContract: FUJI_ADDRESSES.Forwarder as Address,
} as const;

const FORWARD_REQUEST_TYPES = {
  ForwardRequest: [
    { name: "from", type: "address" },
    { name: "to", type: "address" },
    { name: "value", type: "uint256" },
    { name: "gas", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint48" },
    { name: "data", type: "bytes" },
  ],
} as const;

async function fetchNonce(address: string): Promise<number> {
  const res = await fetch(`${API_BASE}/relay/nonce/${address}`);
  if (!res.ok) throw new Error(`Failed to fetch nonce: ${res.statusText}`);
  return (await res.json()).nonce;
}

async function submitRelay(
  request: Record<string, unknown>,
  signature: string,
): Promise<string> {
  const res = await fetch(`${API_BASE}/relay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ request, signature }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Relay failed");
  }
  return (await res.json()).tx_hash;
}

export function useMetaTx() {
  const { data: walletClient } = useWalletClient();

  const sendMetaTx = useCallback(
    async (
      targetContract: Address,
      calldata: Hex,
      options?: { gasLimit?: number; value?: number },
    ): Promise<string> => {
      if (!walletClient) throw new Error("Wallet not connected");

      const userAddress = walletClient.account.address;
      const nonce = await fetchNonce(userAddress);
      const deadline = Math.floor(Date.now() / 1000) + 300;

      const forwardRequest = {
        from: userAddress,
        to: targetContract,
        value: options?.value ?? 0,
        gas: options?.gasLimit ?? 500_000,
        nonce,
        deadline,
        data: calldata,
      };

      const signature = await walletClient.signTypedData({
        domain: FORWARDER_DOMAIN,
        types: FORWARD_REQUEST_TYPES,
        primaryType: "ForwardRequest",
        message: forwardRequest,
      });

      return submitRelay(forwardRequest, signature);
    },
    [walletClient],
  );

  return { sendMetaTx };
}
