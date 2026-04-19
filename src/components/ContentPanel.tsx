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

  // Listen for data-changed events: show banner + start polling
  useEffect(() => {
    const handler = () => {
      setRegenerating(true);
      stopPolling();

      let attempts = 0;
      pollRef.current = setInterval(async () => {
        attempts++;
        if (attempts > 60) { // 60 x 3s = 3 min max
          stopPolling();
          setRegenerating(false);
          fetchArticle(); // fetch whatever is available
          return;
        }
        try {
          const vr = await fetch(`${API}/article/${encodeURIComponent(topic.trim())}/version`);
          const vd = await vr.json();
          if (vd.hash && vd.hash !== versionRef.current) {
            stopPolling();
            setRegenerating(false);
            fetchArticle();
          }
        } catch {}
      }, 3000);
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
            <strong>Updating article</strong> — your claim was created successfully.
            The article is regenerating in the background and will refresh automatically.
            Please don't recreate the claim or manually refresh.
          </span>
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0 }}>
        <ArticleView article={article} onRefresh={fetchArticle} />
      </div>
    </div>
  );
}
