import { erc20ABI, useWriteContract } from "wagmi";

export function useApproveERC20() {
  const { writeContractAsync } = useWriteContract();

  async function approve(
    token: `0x${string}`,
    spender: `0x${string}`,
    amount: bigint
  ) {
    return writeContractAsync({
      address: token,
      abi: erc20ABI,
      functionName: "approve",
      args: [spender, amount],
    });
  }

  return { approve };
}

