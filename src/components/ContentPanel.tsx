// frontend/src/components/ContentPanel.tsx
import TopicExplorer from "./TopicExplorer";
import ClaimModal from "./ClaimModal";

function InlineClaimBadge({
  claim,
  onClick,
}: {
  claim: any;
  onClick: () => void;
}) {
  const isOnChain = claim.on_chain?.post_id != null;
  const vs = claim.verity_score ?? 0;
  return (
    <sup
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 20,
        height: 20,
        borderRadius: "50%",
        background: isOnChain
          ? vs > 0
            ? "#00cc44"
            : vs < 0
              ? "#cc2222"
              : "#6b7280"
          : "#ccc",
        color: "#fff",
        fontSize: 10,
        fontWeight: 700,
        cursor: "pointer",
        marginLeft: 2,
        verticalAlign: "super",
      }}
      title={`${claim.text} (VS: ${vs})`}
    >
      {isOnChain ? (claim.on_chain?.post_id ?? "✓") : "?"}
    </sup>
  );
}

function InlineArticleView({
  result,
  onPinClaim,
}: {
  result: any;
  onPinClaim: (claim: any) => void;
}) {
  const title = result.title || "Results";

  if (result.kind === "claims") {
    const claims = result.claims || [];
    return (
      <div className="card" style={{ padding: "20px 16px" }}>
        <h2>{title}</h2>
        {claims.map((claim: any, i: number) => (
          <div key={i} style={{ marginBottom: 8 }}>
            {claim.text}
            <InlineClaimBadge claim={claim} onClick={() => onPinClaim(claim)} />
          </div>
        ))}
      </div>
    );
  }

  if (result.kind === "article") {
    const sections = result.sections || [];
    return (
      <div className="card" style={{ padding: "20px 16px" }}>
        <h2>{title}</h2>
        {sections.map((section: any, si: number) => (
          <div key={si} style={{ marginBottom: 16 }}>
            <p>
              {section.text}
              {(section.claims || []).map((claim: any, ci: number) => (
                <InlineClaimBadge
                  key={ci}
                  claim={claim}
                  onClick={() => onPinClaim(claim)}
                />
              ))}
            </p>
          </div>
        ))}
      </div>
    );
  }

  return null;
}

export default function ContentPanel({
  result,
  onPinClaim,
}: {
  result: any | null;
  onPinClaim: (claim: any) => void;
}) {
  if (!result) return null;

  if (result.kind === "non_actionable") {
    return <div className="card muted">{result.message}</div>;
  }

  // Topic Explorer (replaces old TopicView)
  if (result.topic_rows && result.topic_rows.length > 0) {
    return (
      <TopicExplorer
        rows={result.topic_rows}
        title={result.title || "Results"}
      />
    );
  }

  // Fallback: inline article/claims view
  return <InlineArticleView result={result} onPinClaim={onPinClaim} />;
}
