import { useMemo, useState } from "react";
import { interpret, type InterpretResponse } from "./api";
import VSPMarketWidget from "./components/VSPMarketWidget";
import ContentPanel from "./components/ContentPanel";
import ClaimModal from "./components/ClaimModal"; // Add this import

export default function App() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<InterpretResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pinnedClaim, setPinnedClaim] = useState<any | null>(null); // State for pinned claim

  const canSend = useMemo(
    () => input.trim().length > 0 && !loading,
    [input, loading]
  );

  async function submit() {
    if (!canSend) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await interpret(input.trim());
      setResult(r);
      setInput("");
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container watermark-bg">
      {/* HEADER */}
      <div
        className="row header"
        style={{
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h2 style={{ margin: 0 }}>Verisphere</h2>
        <VSPMarketWidget />
      </div>

      {/* INPUT */}
      <div className="card">
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
          className="btn btn-primary"
          disabled={!canSend}
          onClick={submit}
        >
          Submit
        </button>
      </div>

      {/* CONTENT */}
      <div style={{ marginTop: 12 }}>
        {loading && <div className="card muted">Thinking…</div>}
        {error && <div className="card error">{error}</div>}
        {!loading && result && <ContentPanel result={result} onPinClaim={setPinnedClaim} />}
      </div>

      {/* FOOTER */}
      <footer className="footer">
        <a href="/whitepaper.pdf">Whitepaper</a>
        <a href="/help">Help</a>
        <a href="/about">About</a>
        <span>© {new Date().getFullYear()} Verisphere</span>
      </footer>

      {/* Pinned Claim Modal (portal at root level) */}
      {pinnedClaim && (
        <div className="pinned-overlay" onClick={() => setPinnedClaim(null)}>
          <div className="pinned-card" onClick={(e) => e.stopPropagation()}>
            <ClaimModal claim={pinnedClaim} onClose={() => setPinnedClaim(null)} />
          </div>
        </div>
      )}
    </div>
  );
}
