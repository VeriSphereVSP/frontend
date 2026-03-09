// frontend/src/components/article/types.ts

export type Sentence = {
  sentence_id: number;
  sort_order: number;
  text: string;
  post_id: number | null;
  replaced_by: number | null;
  stake_support: number;
  stake_challenge: number;
  verity_score: number;
};

export type Section = {
  section_id: number;
  heading: string;
  sentences: Sentence[];
};

export type Article = {
  article_id: number;
  title: string;
  topic_key: string;
  sections: Section[];
};

export type Edge = {
  claim_post_id: number;
  link_post_id: number;
  is_challenge: boolean;
  claim_text?: string;
  claim_vs?: number;
  _dir?: string;
};
