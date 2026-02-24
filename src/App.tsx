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
      // Don't clear input — user may want to reference or edit it
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-wrapper">
      {/* Fixed top bar */}
      <header className="top-bar">
        <div className="top-bar-container">
          <h2 className="logo">Verisphere</h2>
          <VSPMarketWidget />
        </div>
      </header>

      {/* Main content */}
      <main className="main-content watermark-bg">
        <div className="container">
          {/* Input */}
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

          {/* Result */}
          <div style={{ marginTop: 16 }}>
            {loading && <div className="card muted">Thinking…</div>}
            {error && <div className="card error">{error}</div>}
            {!loading && result && (
              <ContentPanel result={result} onPinClaim={setPinnedClaim} />
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="footer">
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
