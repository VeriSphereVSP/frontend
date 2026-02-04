// frontend/src/web3/tokenAddresses.ts

import { avalancheFuji, avalanche } from "wagmi/chains";

// Read chain environment from Vite env (defaults to Fuji/testnet)
const CHAIN_ENV = import.meta.env.VITE_CHAIN_ENV || "fuji";
const CHAIN_ID = CHAIN_ENV === "mainnet" ? avalanche.id : avalancheFuji.id;

// Hardwired USDC addresses (official testnet & mainnet)
const USDC_BY_CHAIN: Record<number, `0x${string}`> = {
  [avalancheFuji.id]: "0x5425890298Aed601595a70AB815c96711a31Bc65", // Fuji testnet USDC
  [avalanche.id]: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",   // Avalanche mainnet USDC
};

// Optional override from .env (for testing or overrides)
const USDC_TOKEN_ADDRESS =
  (import.meta.env.VITE_USDC_ADDRESS as `0x${string}` | undefined) ||
  USDC_BY_CHAIN[CHAIN_ID];

if (!USDC_TOKEN_ADDRESS) {
  console.warn("No USDC address configured for chain ID", CHAIN_ID);
}

// Export helper function (can expand later for VSP, other tokens)
export function getTokenAddresses(chainId = CHAIN_ID) {
  return {
    USDC: USDC_TOKEN_ADDRESS,
    // VSP: "0xYourVSPAddressHere", // keep dynamic or hardwire if needed
    // ... add more tokens later
  };
}

export function getQuoteConfig() {
  return {
    symbol: "USDC",
  };
}
