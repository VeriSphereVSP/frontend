export type ClaimAction = {
  type: string;
  label: string;
  payload: Record<string, unknown>;
};

export type ClaimCard = {
  local_id?: string;
  text: string;
  confidence: number;
  type?: string;
  actions?: ClaimAction[];
  on_chain?: any; // From backend (claim_id, similarity, etc.)
  stake_support: number;
  stake_challenge: number;
  author: string;
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

  evs?: number;          // effective Verity Score [-100,100]
  on_chain?: boolean;

  confidence?: number;  // existing backend field
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

export type InterpretResponse =
  | { kind: "article"; title: string; sections: ArticleSection[] }
  | { kind: "non_actionable"; message: string };

