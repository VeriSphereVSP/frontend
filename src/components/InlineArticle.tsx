import InlineClaim from "./InlineClaim";

export default function InlineArticle({ article }: { article: any }) {
  return (
    <div className="card">
      <h3>{article.title}</h3>

      {article.sections.map((s) => (
        <p key={s.id} className="article-paragraph">
          <InlineClaim text={s.text} claims={s.claims} />
        </p>
      ))}
    </div>
  );
}
