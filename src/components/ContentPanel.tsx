import InlineArticle from "./InlineArticle";
import ClaimCard from "./ClaimCard";

export default function ContentPanel({ result }: { result: any | null }) {
  if (!result) return null;

  if (result.kind === "non_actionable") {
    return <div className="card muted">{result.message}</div>;
  }

  if (result.kind === "claims") {
    return (
      <div className="col">
        {result.claims.map((c: any, i: number) => (
          <ClaimCard key={i} card={c} onAction={() => {}} />
        ))}
      </div>
    );
  }

  if (result.kind === "article") {
    return <InlineArticle article={result} />;
  }

  return null;
}

