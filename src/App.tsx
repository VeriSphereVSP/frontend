// frontend/src/App.tsx
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
      {/* Top bar: logo + market widget */}
      <header className="top-bar" style={{ flexShrink: 0 }}>
        <div className="top-bar-container">
          <h2 className="logo">Verisphere</h2>
          <VSPMarketWidget />
        </div>
      </header>

      {/* Compact prompt bar — single line input */}
      <div
        style={{
          flexShrink: 0,
          background: "#f8f9fa",
          borderBottom: "1px solid #e5e7eb",
          padding: "10px 0",
        }}
      >
        <div className="container" style={{ padding: "0 16px" }}>
          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              maxWidth: 700,
              margin: "0 auto",
            }}
          >
            <input
              className="input"
              type="text"
              placeholder="State a claim, or search a topic…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              style={{
                flex: 1,
                padding: "9px 14px",
                fontSize: 14,
                borderRadius: 10,
              }}
            />
            <button
              className="btn btn-primary"
              disabled={!canSend}
              onClick={submit}
              style={{
                padding: "9px 20px",
                fontSize: 14,
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              {loading ? "…" : "Submit"}
            </button>
          </div>
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
