// frontend/src/deployments/fuji.ts
// Re-exports addresses from @verisphere/protocol (the single source of truth).
// Kept for backward compatibility with components that import from here.
// New code should import directly from @verisphere/protocol.

export { FUJI_ADDRESSES } from "@verisphere/protocol";

// Token addresses not in the core deployment
export const FUJI_USDC =
  "0x5425890298Aed601595a70AB815c96711a31Bc65" as `0x${string}`;
