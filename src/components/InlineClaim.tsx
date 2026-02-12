import React, { useState } from "react";
import ClaimCard from "./ClaimCard";
import type { ClaimCard as ClaimCardT } from "../types";

export default function InlineClaim({
  text,
  claims,
  onPinClaim,
}: {
  text: string;
  claims: ClaimCardT[];
  onPinClaim: (claim: ClaimCardT) => void;
}) {
  const [hoveredClaim, setHoveredClaim] = useState<ClaimCardT | null>(null);

  return (
    <span
      onMouseLeave={() => setHoveredClaim(null)}
      style={{ position: "relative", display: "inline-block" }}
    >
      {text}
      {claims.map((claim, i) => (
        <span
          key={i}
          className="claim-footnote"
          onMouseEnter={() => setHoveredClaim(claim)}
          onClick={() => onPinClaim(claim)}
        >
          <span className="footnote-icon">{i + 1}</span>
        </span>
      ))}

      {/* Hover popup */}
      {hoveredClaim && (
        <div
          className="claim-hover-popup"
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            top: "2.4em",
            zIndex: 40,
            width: "420px",
            pointerEvents: "none",
          }}
        >
          <ClaimCard card={hoveredClaim} onOpenModal={() => onPinClaim(hoveredClaim)} />
        </div>
      )}
    </span>
  );
}
