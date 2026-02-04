import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App";
import "./styles.css";

import "@rainbow-me/rainbowkit/styles.css";

import { WagmiProvider } from "wagmi";
import { RainbowKitProvider, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { avalancheFuji } from "wagmi/chains";

/* --------------------------------------------------
   Chain selection
-------------------------------------------------- */
const chainEnv = import.meta.env.VITE_CHAIN_ENV;

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "fallback-local-id";

const chains =
  chainEnv === "mainnet" ? [avalanche] : [avalancheFuji];

/* --------------------------------------------------
   Wagmi + RainbowKit config (v2-correct)
-------------------------------------------------- */
const config = getDefaultConfig({
  appName: "Verisphere",
  projectId,
  chains,
  ssr: false,

  // IMPORTANT:
  // prevents MetaMask auto-connecting as MM wallet
  autoConnect: false,
});

/* --------------------------------------------------
   React Query
-------------------------------------------------- */
const queryClient = new QueryClient();

/* --------------------------------------------------
   Render
-------------------------------------------------- */
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={config}>
        <RainbowKitProvider chains={chains}>
          <App />
        </RainbowKitProvider>
      </WagmiProvider>
    </QueryClientProvider>
  </React.StrictMode>
);

