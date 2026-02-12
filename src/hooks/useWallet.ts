import { useAccount, useSignMessage } from "wagmi";

export function useWallet() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  async function sign(payload: string): Promise<string> {
    return signMessageAsync({ message: payload });
  }

  return {
    address,
    isConnected,
    sign,
  };
}

