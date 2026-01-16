import { avalancheFuji, avalanche } from "wagmi/chains";

export type ChainEnv = "fuji" | "mainnet";

export const CHAIN_ENV: ChainEnv =
  (import.meta.env.VITE_CHAIN_ENV as ChainEnv) ?? "fuji";

export const APP_CHAIN =
  CHAIN_ENV === "mainnet" ? avalanche : avalancheFuji;

export const CHAIN_LABEL =
  CHAIN_ENV === "mainnet"
    ? "Avalanche Mainnet"
    : "Avalanche Fuji (Testnet)";

