// frontend/src/web3/signPermit.ts
import type { Address, WalletClient } from "viem";
import type { PublicClient } from "viem";
import type { PermitData } from "./useMetaTx";

const NONCES_ABI = [
  {
    inputs: [{ name: "owner", type: "address" }],
    name: "nonces",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const PERMIT_TYPES = {
  Permit: [
    { name: "owner", type: "address" },
    { name: "spender", type: "address" },
    { name: "value", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

/**
 * Sign an EIP-2612 permit for a token.
 *
 * @param walletClient — the connected wallet
 * @param publicClient — for reading nonce
 * @param tokenAddress — the ERC-2612 token
 * @param tokenName — e.g. "VeriSphere"
 * @param tokenVersion — e.g. "1"
 * @param spender — who the permit authorizes
 * @param value — amount to approve (in wei)
 * @param chainId — chain ID
 * @returns PermitData to include in relay request
 */
export async function signPermit({
  walletClient,
  publicClient,
  tokenAddress,
  tokenName,
  tokenVersion,
  spender,
  value,
  chainId,
}: {
  walletClient: WalletClient;
  publicClient: PublicClient;
  tokenAddress: Address;
  tokenName: string;
  tokenVersion: string;
  spender: Address;
  value: bigint;
  chainId: number;
}): Promise<PermitData> {
  const owner = walletClient.account!.address;

  // Read current nonce
  const nonce = await publicClient.readContract({
    address: tokenAddress,
    abi: NONCES_ABI,
    functionName: "nonces",
    args: [owner],
  });

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600); // 1 hour

  const signature = await walletClient.signTypedData({
    domain: {
      name: tokenName,
      version: tokenVersion,
      chainId,
      verifyingContract: tokenAddress,
    },
    types: PERMIT_TYPES,
    primaryType: "Permit",
    message: {
      owner,
      spender,
      value,
      nonce: nonce as bigint,
      deadline,
    },
  });

  const r = "0x" + signature.slice(2, 66);
  const s = "0x" + signature.slice(66, 130);
  const v = parseInt(signature.slice(130, 132), 16);

  return {
    token: tokenAddress,
    owner,
    spender,
    value: value.toString(),
    deadline: Number(deadline),
    v,
    r,
    s,
  };
}
