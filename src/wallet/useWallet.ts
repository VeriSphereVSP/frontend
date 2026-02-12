import { useAccount } from "wagmi";

export function useWallet() {
  const { address, isConnected } = useAccount();

  return {
    address,
    isConnected,
  };
}

