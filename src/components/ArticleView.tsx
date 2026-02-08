import { Article } from "../types";
import ArticleClaim from "./ArticleClaim";

export default function ArticleView({ article }: { article: Article }) {
  if (!article || !Array.isArray(article.sections)) {
    return (
      <div className="card muted">
        Invalid article data
      </div>
    );
  }

  return (
    <div className="card">
      <h3>{article.title}</h3>

      {article.sections.map((section) => (
        <div key={section.id} style={{ marginTop: 12 }}>
          <p className="muted">{section.text}</p>

          <div className="col" style={{ marginTop: 8 }}>
            {section.claims.map((claim, i) => (
              <ArticleClaim key={i} claim={claim} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

