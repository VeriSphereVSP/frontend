import ArticleView from "./ArticleView";
import { InterpretResponse } from "../types";

export default function ContentPanel({ result }: { result: InterpretResponse }) {
  if (result.kind === "non_actionable") {
    return <div className="card muted">{result.message}</div>;
  }

  // Explicitly construct Article object
  const article = {
    title: result.title,
    sections: result.sections,
  };

  return <ArticleView article={article} />;
}

