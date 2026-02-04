// frontend/src/contracts.ts
import { useQuery } from "@tanstack/react-query";

export function useContracts() {
  return useQuery({
    queryKey: ["contracts"],
    queryFn: async () => {
      const res = await fetch("/api/contracts");  // ← with /api/ prefix (proxied to backend)
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to load contracts: ${res.status} - ${text}`);
      }
      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }
      return data as Record<string, `0x${string}`>;
    },
    staleTime: Infinity,
    retry: 2,
  });
}
