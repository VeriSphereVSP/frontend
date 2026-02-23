// frontend/src/types.ts

export type ClaimAction = {
  type: string;
  label: string;
  payload: Record<string, unknown>;
};

// on_chain shape returned by the backend /api/interpret
export type OnChainState = {
  claim_id: number;
  eVS: number; // Effective Verity Score, -100 to +100
  stake: {
    support: number;
    challenge: number;
    total: number;
  };
  links: {
    incoming: number;
    outgoing: number;
  };
};

export type ClaimCard = {
  local_id?: string;
  text: string;
  confidence: number;
  type?: string;
  actions?: ClaimAction[];
  on_chain?: OnChainState; // undefined = not yet on-chain
  stake_support: number;
  stake_challenge: number;
  author: string;
  verity_score?: number;
};

export type InterpretNonActionable = {
  kind: "non_actionable";
  message: string;
};

export type InterpretClaims = {
  kind: "claims";
  claims: ClaimCard[];
};

export type InterpretArticle = {
  kind: "article";
  title: string;
  sections: {
    id: string;
    text: string;
    claims: ClaimCard[];
  }[];
};

export type InterpretResponse =
  | InterpretNonActionable
  | InterpretClaims
  | InterpretArticle;

export type Claim = {
  id?: string;
  text: string;
  evs?: number;
  on_chain?: boolean;
  confidence?: number;
  actions?: any[];
  stake_support?: number;
  stake_challenge?: number;
  total_stake?: number;
};

export type ArticleSection = {
  id: string;
  text: string;
  claims: Claim[];
};

export type Article = {
  title: string;
  sections: ArticleSection[];
};
