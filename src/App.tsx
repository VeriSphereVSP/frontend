// frontend/src/App.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAccount } from "wagmi";
import VSPMarketWidget from "./components/VSPMarketWidget";
import ContentPanel from "./components/ContentPanel";
import ClaimsExplorer from "./components/ClaimsExplorer";
import Portfolio from "./components/Portfolio";

const API = import.meta.env.VITE_API_BASE || "/api";
type View = "explore" | "claims" | "portfolio";
type Suggestion = { key: string; title: string; source: string };

export default function App() {
  const { isConnected } = useAccount();
  const [view, setView] = useState<View>("explore");
  const [input, setInput] = useState("");
  const [topic, setTopic] = useState<string | null>(null);

  // Disambiguation
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSugg, setShowSugg] = useState(false);
  const [selIdx, setSelIdx] = useState(-1);
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggRef = useRef<HTMLDivElement>(null);

  const canSend = useMemo(() => input.trim().length > 0, [input]);

  const fetchSugg = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    try {
      const r = await fetch(
        `${API}/disambiguate?q=${encodeURIComponent(q.trim())}`,
      );
      const d = await r.json();
      setSuggestions(d.results || []);
      setSelIdx(-1);
    } catch {
      setSuggestions([]);
    }
  }, []);

  const handleInput = (v: string) => {
    setInput(v);
    setShowSugg(true);
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(() => fetchSugg(v), 200);
  };

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (
        suggRef.current &&
        !suggRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      )
        setShowSugg(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  function submit(override?: string) {
    const q = (override || input).trim();
    if (!q) return;
    setShowSugg(false);
    setTopic(q);
    setView("explore");
  }

  function handleKey(e: React.KeyboardEvent) {
    if (!showSugg || !suggestions.length) {
      if (e.key === "Enter") submit();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelIdx((p) => Math.min(p + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelIdx((p) => Math.max(p - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selIdx >= 0 && selIdx < suggestions.length) {
        const s = suggestions[selIdx];
        setInput(s.title);
        setShowSugg(false);
        submit(s.title);
      } else submit();
    } else if (e.key === "Escape") setShowSugg(false);
  }

  const navBtn = (label: string, target: View) => (
    <button
      onClick={() => setView(target)}
      style={{
        background: view === target ? "rgba(255,255,255,0.15)" : "transparent",
        border: "none",
        color: "inherit",
        padding: "4px 10px",
        borderRadius: 6,
        fontSize: 13,
        fontWeight: view === target ? 600 : 400,
        cursor: "pointer",
        opacity: view === target ? 1 : 0.7,
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      {/* Top bar */}
      <header className="top-bar" style={{ flexShrink: 0 }}>
        <div className="top-bar-container">
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <h2
              className="logo"
              onClick={() => {
                setView("explore");
                setTopic(null);
              }}
              style={{ cursor: "pointer", margin: 0 }}
            >
              Verisphere
            </h2>
            <nav style={{ display: "flex", gap: 4 }}>
              {navBtn("Explore", "explore")}
              {navBtn("Claims", "claims")}
              {isConnected && navBtn("Portfolio", "portfolio")}
            </nav>
          </div>
          <VSPMarketWidget />
        </div>
      </header>

      {/* Search bar */}
      {view === "explore" && (
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
                position: "relative",
              }}
            >
              <div style={{ flex: 1, position: "relative" }}>
                <input
                  ref={inputRef}
                  type="text"
                  className="input"
                  placeholder="Search a topic or enter a claim…"
                  value={input}
                  onChange={(e) => handleInput(e.target.value)}
                  onKeyDown={handleKey}
                  onFocus={() => {
                    if (suggestions.length) setShowSugg(true);
                  }}
                  style={{
                    width: "100%",
                    padding: "9px 14px",
                    fontSize: 14,
                    borderRadius: 10,
                  }}
                />
                {showSugg && suggestions.length > 0 && (
                  <div
                    ref={suggRef}
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      right: 0,
                      background: "#fff",
                      border: "1px solid #e5e7eb",
                      borderRadius: "0 0 10px 10px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                      zIndex: 100,
                      maxHeight: 280,
                      overflowY: "auto",
                    }}
                  >
                    {suggestions.map((s, i) => (
                      <div
                        key={s.key + i}
                        onClick={() => {
                          setInput(s.title);
                          setShowSugg(false);
                          submit(s.title);
                        }}
                        onMouseEnter={() => setSelIdx(i)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "8px 14px",
                          cursor: "pointer",
                          background: i === selIdx ? "#f3f4f6" : "transparent",
                          borderBottom:
                            i < suggestions.length - 1
                              ? "1px solid #f3f4f6"
                              : "none",
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 600,
                              color: "#111827",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {s.title}
                          </div>
                          <div style={{ fontSize: 11, color: "#9ca3af" }}>
                            {s.source === "cached"
                              ? "Previously explored"
                              : "On-chain claim"}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button
                className="btn btn-primary"
                disabled={!canSend}
                onClick={() => submit()}
                style={{
                  padding: "9px 20px",
                  fontSize: 14,
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <main
        className="watermark-bg"
        style={{ flex: 1, overflowY: "auto", padding: "16px 0" }}
      >
        <div className="container">
          {view === "explore" && topic && <ContentPanel topic={topic} />}
          {view === "explore" && !topic && (
            <div style={{ textAlign: "center", padding: 40, color: "#9ca3af" }}>
              Search a topic to explore its Verisphere article
            </div>
          )}
          {view === "claims" && <ClaimsExplorer />}
          {view === "portfolio" && (
            <Portfolio onBack={() => setView("explore")} />
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
    </div>
  );
}
