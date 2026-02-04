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

export async function interpret(
  input: string,
  model?: string
): Promise<InterpretResponse> {
  const r = await fetch("/api/interpret", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input,
      ...(model ? { model } : {}),
    }),
  });

  const text = await r.text();

  if (!r.ok) {
    throw new Error(text || `Request failed (${r.status})`);
  }

  try {
    return JSON.parse(text) as InterpretResponse;
  } catch {
    throw new Error("Invalid JSON returned from /interpret");
  }
}

