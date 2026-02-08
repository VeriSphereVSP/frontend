import { useState } from "react";
import { Claim } from "../types";
import { evsToBackground } from "../ui/vsColor";
import ClaimCard from "./ClaimCard";
import ClaimModal from "./ClaimModal";

export default function ArticleClaim({ claim }: { claim: Claim }) {
  const [hover, setHover] = useState(false);
  const [open, setOpen] = useState(false);

  return (
    <>
      <div
        style={{
          background: evsToBackground(claim.evs),
          padding: "10px 12px",
          borderRadius: 10,
          position: "relative",
        }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <span>{claim.text}</span>

        <button
          style={{ marginLeft: 8 }}
          title="Open claim"
          onClick={() => setOpen(true)}
        >
          ⓘ
        </button>

        {/* Hover preview */}
        {hover && (
          <div style={{ position: "absolute", zIndex: 20, top: "100%" }}>
            <ClaimCard card={claim as any} />
          </div>
        )}
      </div>

      {/* Modal view */}
      {open && (
        <ClaimModal
          content={claim}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

