import { MMQuote, QuoteSide } from "./types";

export async function fetchQuote(
  side: QuoteSide,
  amount: string
): Promise<MMQuote> {
  const r = await fetch("/api/mm/quote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ side, amount }),
  });

  if (!r.ok) {
    throw new Error(await r.text());
  }

  return r.json();
}

export async function executeTrade(
  quote: MMQuote,
  signature: string
) {
  const r = await fetch(`/api/mm/${quote.side}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quote_nonce: quote.nonce,
      signature,
    }),
  });

  if (!r.ok) {
    throw new Error(await r.text());
  }

  return r.json();
}

