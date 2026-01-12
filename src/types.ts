export type ClaimAction = {
  type:
    | "create_claim"
    | "stake_support"
    | "stake_challenge"
    | "open_details"
    | "reply";
  label: string;
  payload: Record<string, unknown>;
};

export type ClaimCard = {
  local_id?: string;
  text?: string;
  confidence: number;
  type?: string;

  claim_text?: string;

  claim_id?: number;
  classification?: string;
  max_similarity?: number;
  cluster_id?: number;
  canonical_claim_id?: number;
  canonical_claim_text?: string;

  is_atomic?: boolean;
  decomposition?: string[];

  actions: ClaimAction[];
};

export type ArticleSection = {
  id: string;
  text: string;
  claims: ClaimCard[];
};

export type IntentResult =
  | { kind: "non_actionable"; message: string }
  | { kind: "claims"; claims: ClaimCard[] }
  | { kind: "article"; title: string; sections: ArticleSection[] };

export type InterpretResponse = {
  result: IntentResult;
};

