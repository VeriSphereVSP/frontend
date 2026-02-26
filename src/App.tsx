import { useMemo, useState } from "react";
import { interpret, type InterpretResponse } from "./api";
import VSPMarketWidget from "./components/VSPMarketWidget";
import ContentPanel from "./components/ContentPanel";
import ClaimModal from "./components/ClaimModal";

export default function App() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<InterpretResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pinnedClaim, setPinnedClaim] = useState<any | null>(null);

  const canSend = useMemo(
    () => input.trim().length > 0 && !loading,
    [input, loading],
  );

  async function submit() {
    if (!canSend) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await interpret(input.trim());
      setResult(r);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="app-wrapper"
      style={{ display: "flex", flexDirection: "column", height: "100vh" }}
    >
      {/* Fixed top bar */}
      <header className="top-bar" style={{ flexShrink: 0 }}>
        <div className="top-bar-container">
          <h2 className="logo">Verisphere</h2>
          <VSPMarketWidget />
        </div>
      </header>

      {/* Fixed prompt + title area */}
      <div
        style={{ flexShrink: 0, padding: "16px 0 0", background: "#f8f9fa" }}
      >
        <div className="container">
          <div className="card input-card">
            <textarea
              className="input"
              rows={3}
              placeholder="State a claim, or search a topic…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) =>
                (e.metaKey || e.ctrlKey) && e.key === "Enter" && submit()
              }
            />
            <button
              className="btn btn-primary submit-btn"
              disabled={!canSend}
              onClick={submit}
            >
              Submit
            </button>
          </div>
          {/* Topic title — fixed, doesn't scroll */}
          {!loading && result?.title && (
            <h2 style={{ margin: "12px 0 0", fontSize: 22, fontWeight: 700 }}>
              {result.title}
            </h2>
          )}
        </div>
      </div>

      {/* Scrollable results area */}
      <main
        className="watermark-bg"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px 0",
        }}
      >
        <div className="container">
          {loading && <div className="card muted">Thinking…</div>}
          {error && <div className="card error">{error}</div>}
          {!loading && result && (
            <ContentPanel result={result} onPinClaim={setPinnedClaim} />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="footer" style={{ flexShrink: 0 }}>
        <a href="/whitepaper.pdf">Whitepaper</a>
        <a href="/help">Help</a>
        <a href="/about">About</a>
        <span>© {new Date().getFullYear()} Verisphere</span>
      </footer>

      {/* Pinned Claim Modal */}
      {pinnedClaim && (
        <div className="pinned-overlay" onClick={() => setPinnedClaim(null)}>
          <div className="pinned-card" onClick={(e) => e.stopPropagation()}>
            <ClaimModal
              claim={pinnedClaim}
              onClose={() => setPinnedClaim(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
