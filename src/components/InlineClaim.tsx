import React, { useState } from "react";
import type { ClaimCard } from "../types";
import ClaimCard from "./ClaimCard";

export default function InlineClaim({
  text,
  claims,
}: {
  text: string;
  claims: ClaimCard[];
}) {
  const [active, setActive] = useState<ClaimCard | null>(null);

  return (
    <span
      className="inline-claim"
      onMouseLeave={() => setActive(null)}
    >
      {text}
      {claims.map((c, i) => (
        <sup
          key={i}
          className="claim-sup"
          onMouseEnter={() => setActive(c)}
        >
          ◦
        </sup>
      ))}

      {active && (
        <div className="inline-claim-popover">
          <ClaimCard card={active} onAction={() => {}} />
        </div>
      )}
    </span>
  );
}
