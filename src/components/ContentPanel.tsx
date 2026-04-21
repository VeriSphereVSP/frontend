// frontend/src/components/ContentPanel.tsx
import { useState, useEffect, useCallback, useRef } from "react";
import ArticleView from "./ArticleView";

const API = import.meta.env.VITE_API_BASE || "/api";

export default function ContentPanel({ topic }: { topic: string }) {
  const [article, setArticle] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const versionRef = useRef<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

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

      // Store current version hash
      try {
        const vr = await fetch(`${API}/article/${encodeURIComponent(topic.trim())}/version`);
        const vd = await vr.json();
        versionRef.current = vd.hash;
      } catch {}
    } catch (e: any) {
      setError(e.message || String(e));
    }
    setLoading(false);
  }, [topic]);

  useEffect(() => {
    fetchArticle();
    return stopPolling;
  }, [fetchArticle]);

  // Listen for data-changed events: brief banner then refetch.
  // APP-11 makes cache rebuild synchronous in the relay, so the article
  // is fresh within ~2s. We show a brief banner and refetch after 3s.
  useEffect(() => {
    const handler = () => {
      setRegenerating(true);
      stopPolling();

      // Refetch after a short delay (relay rebuilds cache synchronously)
      pollRef.current = setTimeout(async () => {
        await fetchArticle();
        setRegenerating(false);
        pollRef.current = null;
      }, 3000) as any;
    };

    window.addEventListener("verisphere:data-changed", handler);
    return () => {
      window.removeEventListener("verisphere:data-changed", handler);
      stopPolling();
    };
  }, [topic, fetchArticle]);

  if (loading && !article) return <div className="card muted">Generating article…</div>;
  if (error) return <div className="card error">{error}</div>;
  if (!article) return null;

  return (
    <div style={{ position: "relative", height: "100%", display: "flex", flexDirection: "column" }}>
      {regenerating && (
        <div
          style={{
            padding: "10px 20px",
            background: "linear-gradient(90deg, #eff6ff, #f0fdf4)",
            borderBottom: "1px solid #bfdbfe",
            display: "flex",
            alignItems: "center",
            gap: 10,
            fontSize: 13,
            color: "#1e40af",
            flexShrink: 0,
            zIndex: 20,
          }}
        >
          <span
            style={{
              display: "inline-block",
              width: 16,
              height: 16,
              border: "2px solid #93c5fd",
              borderTopColor: "#2563eb",
              borderRadius: "50%",
              animation: "vs-spin 0.8s linear infinite",
            }}
          />
          <span>
            <strong>Updating article</strong> — refreshing with latest data…
          </span>
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0 }}>
        <ArticleView article={article} onRefresh={fetchArticle} />
      </div>
    </div>
  );
}
