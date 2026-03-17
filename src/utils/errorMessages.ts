// frontend/src/utils/errorMessages.ts
// Maps developer-facing errors to user-friendly messages.

const ERROR_MAP: [RegExp | string, string][] = [
  // Wallet
  [/wallet not connected/i, "Please connect your wallet first."],
  [/user rejected/i, "You cancelled the transaction."],
  [/user denied/i, "You cancelled the transaction."],
  [/rejected the request/i, "You cancelled the transaction."],

  // Balance
  [
    /insufficient.*vsp.*balance/i,
    "You don't have enough VSP. Buy more from the market.",
  ],
  [/insufficient.*balance/i, "Insufficient balance for this transaction."],
  [
    /transfer amount exceeds balance/i,
    "You don't have enough tokens for this transaction.",
  ],

  // Staking
  [/amount must be greater than 0/i, "Enter an amount greater than 0."],
  [
    /not enough stake/i,
    "You don't have enough staked to withdraw that amount.",
  ],

  // Claims
  [/duplicate.*claim/i, "This claim already exists on-chain."],
  [/duplicate.*edge/i, "This link already exists."],
  [/self.*loop/i, "A claim cannot link to itself."],

  // Meta-tx / Relay
  [
    /meta-tx reverted/i,
    "Transaction failed on-chain. Try again or reduce the amount.",
  ],
  [/nonce/i, "Transaction ordering error. Please try again."],
  [/deadline/i, "Transaction expired. Please try again."],
  [/permit.*failed/i, "Token approval failed. Please try again."],
  [/permit.*reverted/i, "Token approval failed. Please try again."],

  // Network
  [/failed to fetch/i, "Network error. Check your connection and try again."],
  [/network.*error/i, "Network error. Check your connection and try again."],
  [/timeout/i, "Request timed out. Please try again."],
  [/http 500/i, "Server error. Please try again in a moment."],
  [/http 400/i, "Invalid request. Please check your input."],
  [/http 429/i, "Too many requests. Please wait a moment and try again."],

  // Moderation
  [/moderat/i, "This content was flagged by our moderation system."],

  // Gas
  [/out of gas/i, "Transaction ran out of gas. Please try again."],
  [/gas/i, "Transaction gas error. Please try again."],

  // BigInt serialization (should be fixed but just in case)
  [/serialize.*bigint/i, "Internal error. Please refresh and try again."],

  // Contract errors
  [
    /execution reverted/i,
    "Transaction was rejected by the smart contract. Try again or adjust your amount.",
  ],
];

export function friendlyError(raw: string | Error | any): string {
  const msg =
    typeof raw === "string"
      ? raw
      : raw?.shortMessage || raw?.message || String(raw);

  for (const [pattern, friendly] of ERROR_MAP) {
    if (typeof pattern === "string") {
      if (msg.toLowerCase().includes(pattern.toLowerCase())) return friendly;
    } else {
      if (pattern.test(msg)) return friendly;
    }
  }

  // Truncate long developer messages
  if (msg.length > 100) {
    return "Something went wrong. Please try again.";
  }

  return msg;
}

// Fire a toast event (usable from non-React code)
export function fireToast(
  message: string,
  type: "success" | "error" | "info" = "info",
) {
  window.dispatchEvent(
    new CustomEvent("verisphere:toast", { detail: { message, type } }),
  );
}
