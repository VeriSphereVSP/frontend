import { useState } from "react";
import { createClaim } from "../api/claims";
import { useWallet } from "../wallet/useWallet";

export function CreateClaimModal() {
  const { address, isConnected } = useWallet();
  const [text, setText] = useState("");

  if (!isConnected || !address) return null;

  async function submit() {
    await createClaim({
      user_address: address,
      content: text,
      nonce: crypto.randomUUID(),
    });
    setText("");
  }

  return (
    <div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button onClick={submit}>Create Claim</button>
    </div>
  );
}

