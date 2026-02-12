import InlineClaim from "./InlineClaim";

export default function InlineArticle({
  article,
  onPinClaim,
}: {
  article: any;
  onPinClaim: (claim: any) => void;
}) {
  return (
    <div className="card">
      <h2>{article.title}</h2>

      {article.sections.map((s: any) => (
        <p key={s.id}>
          <InlineClaim text={s.text} claims={s.claims} onPinClaim={onPinClaim} />
        </p>
      ))}
    </div>
  );
}
