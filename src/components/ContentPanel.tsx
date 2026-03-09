// frontend/src/components/ContentPanel.tsx
import { useState, useEffect, useCallback } from "react";
import ArticleView from "./ArticleView";

const API = import.meta.env.VITE_API_BASE || "/api";

export default function ContentPanel({ topic }: { topic: string }) {
  const [article, setArticle] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchArticle = useCallback(async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(
        `${API}/article/${encodeURIComponent(topic.trim())}`,
      );
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setArticle(data);
    } catch (e: any) {
      setError(e.message || String(e));
    }
    setLoading(false);
  }, [topic]);

  useEffect(() => {
    fetchArticle();
  }, [fetchArticle]);

  if (loading) return <div className="card muted">Generating article…</div>;
  if (error) return <div className="card error">{error}</div>;
  if (!article) return null;

  return <ArticleView article={article} onRefresh={fetchArticle} />;
}
