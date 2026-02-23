// frontend/src/contracts.ts
// Provides contract addresses via React Query (fetched from backend /api/contracts).
// Used by VSPMarketWidget and TradeModal which need dynamic/runtime contract data.
// For static use in web3 hooks, import FUJI_ADDRESSES from ./deployments/fuji instead.

import { useQuery } from "@tanstack/react-query";
import type { ContractAddresses } from "@verisphere/protocol";

export function useContracts() {
  return useQuery({
    queryKey: ["contracts"],
    queryFn: async () => {
      const res = await fetch("/api/contracts");
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to load contracts: ${res.status} - ${text}`);
      }
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      return data as ContractAddresses & { USDC?: `0x${string}` };
    },
    staleTime: Infinity,
    retry: 2,
  });
}
