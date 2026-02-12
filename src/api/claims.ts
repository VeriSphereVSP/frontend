import { api } from "./client";

export async function createClaim(payload: {
  user_address: string;
  content: string;
  nonce: string;
}) {
  return api("/api/claims/create", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

