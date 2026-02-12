export type QuoteSide = "buy" | "sell";

export interface MMQuote {
  side: QuoteSide;
  price: string;          // fixed-point decimal string
  amount_in: string;
  amount_out: string;
  expires_at: number;     // unix seconds
  nonce: string;
}

export interface CreateClaimRequest {
  content: string;
  author: string;
  nonce: string;
}

export interface CreateClaimResponse {
  claim_id: string;
}

