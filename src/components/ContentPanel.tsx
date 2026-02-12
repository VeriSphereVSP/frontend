import InlineArticle from "./InlineArticle";

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

  const article = {
    title: result.title || "Results",
    sections: result.sections || [{
      id: "s1",
      text: result.claims?.map((c: any) => c.text).join('. ') || "",
      claims: result.claims || [],
    }],
  };

  return <InlineArticle article={article} onPinClaim={onPinClaim} />;
}
