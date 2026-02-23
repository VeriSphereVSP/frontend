// frontend/src/wallet/erc20.ts
import { useWriteContract } from "wagmi";

// Minimal ERC-20 ABI — approve only (wagmi v2 removed built-in erc20ABI)
const ERC20_APPROVE_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export function useApproveERC20() {
  const { writeContractAsync } = useWriteContract();

  async function approve(
    token: `0x${string}`,
    spender: `0x${string}`,
    amount: bigint,
  ) {
    return writeContractAsync({
      address: token,
      abi: ERC20_APPROVE_ABI,
      functionName: "approve",
      args: [spender, amount],
    });
  }

  return { approve };
}
