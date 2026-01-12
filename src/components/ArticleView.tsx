import React from "react";
import type { ArticleSection } from "../types";
import InlineClaim from "./InlineClaim";

export default function ArticleView({
  article,
}: {
  article: { title: string; sections: ArticleSection[] };
}) {
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

