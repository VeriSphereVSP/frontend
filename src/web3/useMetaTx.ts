// frontend/src/web3/useMetaTx.ts
import { useCallback } from "react";
import { useWalletClient } from "wagmi";
import { type Hex, type Address } from "viem";
import { FUJI_ADDRESSES } from "@verisphere/protocol";

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

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

function extractErrorMessage(err: any): string {
  if (typeof err === "string") return err;
  if (Array.isArray(err))
    return err.map((e: any) => e.msg || JSON.stringify(e)).join("; ");
  if (err?.detail) return extractErrorMessage(err.detail);
  if (err?.message) return String(err.message);
  try {
    return JSON.stringify(err);
  } catch {
    return "Unknown error";
  }
}

export interface RelayResponse {
  ok: boolean;
  tx_hash: string;
  claim?: {
    post_id: number;
    text: string;
    creator: string;
    support_total: number;
    challenge_total: number;
    user_support?: number;
    user_challenge?: number;
  };
}

async function submitRelay(
  request: Record<string, unknown>,
  signature: string,
): Promise<RelayResponse> {
  const res = await fetch(`${API_BASE}/relay`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ request, signature }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(extractErrorMessage(body));
  }
  return await res.json();
}

export function useMetaTx() {
  const { data: walletClient } = useWalletClient();

  const sendMetaTx = useCallback(
    async (
      targetContract: Address,
      calldata: Hex,
      options?: { gasLimit?: number; value?: number },
    ): Promise<RelayResponse> => {
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
