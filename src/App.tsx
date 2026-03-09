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

/* ── Landing Hero (shown when no topic is selected) ── */
function LandingHero({ onSubmit }: { onSubmit: (q: string) => void }) {
  const [input, setInput] = useState("");
  const examples = [
    { label: "Earth", icon: "🌍" },
    { label: "Bitcoin", icon: "₿" },
    { label: "Quantum Computing", icon: "⚛" },
    { label: "Climate Change", icon: "🌡" },
  ];

  return (
    <div
      style={{
        textAlign: "center",
        maxWidth: 680,
        margin: "0 auto",
        padding: "60px 20px 40px",
      }}
    >
      {/* Tagline */}
      <h1
        style={{
          fontSize: 38,
          fontWeight: 800,
          color: "#111827",
          lineHeight: 1.15,
          letterSpacing: "-0.02em",
          marginBottom: 12,
        }}
      >
        Truth has a price.
        <br />
        <span style={{ color: "#2563eb" }}>Stake yours.</span>
      </h1>
      <p
        style={{
          fontSize: 17,
          color: "#6b7280",
          lineHeight: 1.6,
          maxWidth: 520,
          margin: "0 auto 32px",
        }}
      >
        Verisphere is a truth-staking protocol. Every factual claim lives
        on-chain. Back what you believe with real tokens — and earn when you're
        right.
      </p>

      {/* Search bar — prominent */}
      <div
        style={{
          display: "flex",
          gap: 10,
          maxWidth: 560,
          margin: "0 auto 24px",
          position: "relative",
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && input.trim()) onSubmit(input.trim());
          }}
          placeholder="Enter a topic, claim, or paste a URL…"
          style={{
            flex: 1,
            padding: "14px 18px",
            fontSize: 16,
            borderRadius: 12,
            border: "2px solid #e5e7eb",
            outline: "none",
            transition: "border 0.2s",
          }}
          onFocus={(e) => (e.target.style.borderColor = "#2563eb")}
          onBlur={(e) => (e.target.style.borderColor = "#e5e7eb")}
        />
        <button
          onClick={() => {
            if (input.trim()) onSubmit(input.trim());
          }}
          disabled={!input.trim()}
          style={{
            padding: "14px 28px",
            fontSize: 16,
            fontWeight: 600,
            borderRadius: 12,
            border: "none",
            cursor: "pointer",
            background: input.trim() ? "#111827" : "#d1d5db",
            color: "#fff",
            transition: "background 0.2s",
            flexShrink: 0,
          }}
        >
          Explore
        </button>
      </div>

      {/* Quick examples */}
      <div
        style={{
          display: "flex",
          gap: 8,
          justifyContent: "center",
          flexWrap: "wrap",
          marginBottom: 48,
        }}
      >
        <span style={{ fontSize: 13, color: "#9ca3af", alignSelf: "center" }}>
          Try:
        </span>
        {examples.map((ex) => (
          <button
            key={ex.label}
            onClick={() => onSubmit(ex.label)}
            style={{
              padding: "6px 14px",
              borderRadius: 20,
              border: "1px solid #e5e7eb",
              background: "#fff",
              fontSize: 13,
              cursor: "pointer",
              color: "#374151",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#2563eb";
              e.currentTarget.style.color = "#2563eb";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#e5e7eb";
              e.currentTarget.style.color = "#374151";
            }}
          >
            {ex.icon} {ex.label}
          </button>
        ))}
      </div>

      {/* How it works — 3 steps */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 20,
          textAlign: "left",
          marginBottom: 48,
        }}
      >
        {[
          {
            step: "1",
            title: "Explore",
            desc: "Search any topic. Verisphere generates a fact-checked article where every sentence is a stakeable claim.",
            color: "#2563eb",
          },
          {
            step: "2",
            title: "Stake",
            desc: "Back claims you believe are true with VSP tokens. Challenge claims you think are false. Your stake is your conviction.",
            color: "#059669",
          },
          {
            step: "3",
            title: "Earn",
            desc: "When consensus forms, stakers on the right side earn rewards. Truth pays — misinformation costs.",
            color: "#d97706",
          },
        ].map((s) => (
          <div
            key={s.step}
            style={{
              padding: 20,
              background: "#fff",
              borderRadius: 12,
              border: "1px solid #e5e7eb",
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: s.color + "15",
                color: s.color,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 800,
                fontSize: 16,
                marginBottom: 10,
              }}
            >
              {s.step}
            </div>
            <div
              style={{
                fontWeight: 700,
                fontSize: 15,
                color: "#111827",
                marginBottom: 4,
              }}
            >
              {s.title}
            </div>
            <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>
              {s.desc}
            </div>
          </div>
        ))}
      </div>

      {/* What you can do */}
      <div
        style={{
          display: "flex",
          gap: 12,
          justifyContent: "center",
          flexWrap: "wrap",
          padding: "20px 0",
          borderTop: "1px solid #f0f0f0",
        }}
      >
        {[
          { icon: "🔍", text: "Search any topic" },
          { icon: "🔗", text: "Paste any URL" },
          { icon: "⚖️", text: "Stake on claims" },
          { icon: "🔀", text: "Link evidence" },
          { icon: "📊", text: "Track your portfolio" },
        ].map((item) => (
          <span
            key={item.text}
            style={{
              fontSize: 12,
              color: "#6b7280",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span style={{ fontSize: 14 }}>{item.icon}</span> {item.text}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── Main App ── */
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
    setInput(q);
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

  const navBtn = (label: string, target: View, requireConnect = false) => {
    if (requireConnect && !isConnected) return null;
    return (
      <button
        onClick={() => setView(target)}
        style={{
          background:
            view === target ? "rgba(255,255,255,0.18)" : "transparent",
          border: "none",
          color: "inherit",
          padding: "5px 12px",
          borderRadius: 6,
          fontSize: 13,
          fontWeight: view === target ? 700 : 400,
          cursor: "pointer",
          opacity: view === target ? 1 : 0.7,
          transition: "all 0.15s",
        }}
      >
        {label}
      </button>
    );
  };

  const showingArticle = view === "explore" && topic;

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
                setInput("");
              }}
              style={{ cursor: "pointer", margin: 0 }}
            >
              Verisphere
            </h2>
            <nav style={{ display: "flex", gap: 2 }}>
              {navBtn("Explore", "explore")}
              {navBtn("Claims", "claims")}
              {navBtn("Portfolio", "portfolio", true)}
            </nav>
          </div>
          <VSPMarketWidget />
        </div>
      </header>

      {/* Search bar — only when viewing an article (compact mode) */}
      {showingArticle && (
        <div
          style={{
            flexShrink: 0,
            background: "#f8f9fa",
            borderBottom: "1px solid #e5e7eb",
            padding: "8px 0",
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
                  placeholder="Search a topic, enter a claim, or paste a URL…"
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
                Go
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <main
        className="watermark-bg"
        style={{ flex: 1, overflowY: "auto", padding: "0" }}
      >
        <div
          className="container"
          style={{ padding: view === "explore" && !topic ? 0 : "16px" }}
        >
          {/* Landing page — when no topic */}
          {view === "explore" && !topic && (
            <LandingHero onSubmit={(q) => submit(q)} />
          )}

          {/* Article view — when topic selected */}
          {view === "explore" && topic && <ContentPanel topic={topic} />}

          {/* Claims explorer */}
          {view === "claims" && <ClaimsExplorer />}

          {/* Portfolio */}
          {view === "portfolio" && (
            <Portfolio onBack={() => setView("explore")} />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="footer" style={{ flexShrink: 0 }}>
        <a href="https://github.com/VeriSphereVSP/docs/blob/main/whitepaper.md" target="_blank" rel="noopener">Whitepaper</a>
        <a href="https://discord.gg/bzAdzceK" target="_blank" rel="noopener">Discord</a>
        <a href="https://github.com/VeriSphereVSP/docs" target="_blank" rel="noopener">GitHub</a>
        <span>© {new Date().getFullYear()} Verisphere</span>
      </footer>
    </div>
  );
}
