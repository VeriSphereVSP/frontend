import { useMemo, useState } from "react";
import { interpret, type InterpretResponse } from "./api";
import VSPMarketWidget from "./components/VSPMarketWidget";
import TradeModal from "./components/TradeModal";

export default function App() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<InterpretResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tradeSide, setTradeSide] = useState<"buy" | "sell" | null>(null);

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
      <div className="row header">
        <h2>VeriSphere</h2>

        {/* Wallet + Buy/Sell */}
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
          style={{ resize: "vertical" }}
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
        {!loading && result && (
          <pre className="card">{JSON.stringify(result, null, 2)}</pre>
        )}
      </div>

      {/* FOOTER */}
      <footer className="footer">
        <a href="/whitepaper.pdf">Whitepaper</a>
        <a href="/help">Help</a>
        <a href="/about">About</a>
        <span>© {new Date().getFullYear()} VeriSphere</span>
      </footer>

      {tradeSide && (
        <TradeModal side={tradeSide} onClose={() => setTradeSide(null)} />
      )}
    </div>
  );
}

