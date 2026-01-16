import "@rainbow-me/rainbowkit/styles.css";

import { ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import {
  RainbowKitProvider,
  getDefaultConfig,
} from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { APP_CHAIN } from "./chains";

const queryClient = new QueryClient();

const wagmiConfig = getDefaultConfig({
  appName: "VeriSphere",
  projectId:
    import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ??
    "verisphere-dev-fallback",
  chains: [APP_CHAIN],
  ssr: false,
});

export function Web3Provider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

