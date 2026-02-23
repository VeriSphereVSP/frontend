import { useEffect, useState } from "react";
import { useAccount, useBalance, useChainId } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import TradeModal from "./TradeModal";
import { useContracts } from "../contracts";

type MMQuote = {
  buy_usdc: number;
  sell_usdc: number;
};

export default function VSPMarketWidget() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  const {
    data: contracts,
    isLoading: contractsLoading,
    error: contractsError,
  } = useContracts();

  const [quote, setQuote] = useState<MMQuote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [side, setSide] = useState<"buy" | "sell" | null>(null);

  // Poll market maker quote every 5 seconds
  useEffect(() => {
    let alive = true;

    async function fetchQuote() {
      try {
        const res = await fetch("/api/mm/quote");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        if (
          typeof data.buy_usdc !== "number" ||
          isNaN(data.buy_usdc) ||
          typeof data.sell_usdc !== "number" ||
          isNaN(data.sell_usdc)
        ) {
          throw new Error(
            "Malformed quote: invalid or missing buy_usdc/sell_usdc",
          );
        }

        if (alive) {
          setQuote({
            buy_usdc: data.buy_usdc,
            sell_usdc: data.sell_usdc,
          });
          setError(null);
        }
      } catch (e: any) {
        if (alive) setError(e.message ?? "Market maker error");
        console.error("Quote fetch failed:", e);
      }
    }

    fetchQuote();
    const id = setInterval(fetchQuote, 5000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  // VSP balance
  const { data: vspBalanceData, refetch: refetchVsp } = useBalance({
    address,
    token: contracts?.VSPToken,
    query: {
      enabled: Boolean(isConnected && address && contracts?.VSPToken),
      refetchInterval: 5000,
    },
  });

  // USDC balance
  const { data: usdcBalanceData, refetch: refetchUsdc } = useBalance({
    address,
    token: contracts?.USDC,
    query: {
      enabled: Boolean(isConnected && address && contracts?.USDC),
      refetchInterval: 5000,
    },
  });

  const refetchBalances = () => {
    refetchVsp();
    refetchUsdc();
  };

  // Loading & error states
  if (contractsLoading)
    return <span className="muted">Loading contracts…</span>;
  if (contractsError) return <span className="error">Contracts error</span>;
  if (error) return <span className="error">{error}</span>;
  if (!quote) return <span className="muted">Loading price…</span>;

  return (
    <div className="vsp-widget-compact">
      {/* Wallet connect */}
      <ConnectButton />

      {/* Balances (compact) */}
      {isConnected && (
        <div className="row" style={{ gap: 8 }}>
          <span className="badge">
            VSP:{" "}
            {vspBalanceData
              ? Number(vspBalanceData.formatted).toFixed(2)
              : "0.00"}
          </span>
          <span className="badge">
            USDC:{" "}
            {usdcBalanceData
              ? Number(usdcBalanceData.formatted).toFixed(2)
              : "0.00"}
          </span>
        </div>
      )}

      {/* Buy / Sell buttons */}
      <div className="vsp-prices">
        <button
          className="btn btn-primary vsp-button"
          disabled={!isConnected || !contracts?.VSPToken}
          onClick={() => setSide("buy")}
        >
          Buy @ {quote.buy_usdc.toFixed(4)}
        </button>
        <button
          className="btn vsp-button"
          disabled={!isConnected || !contracts?.VSPToken}
          onClick={() => setSide("sell")}
        >
          Sell @ {quote.sell_usdc.toFixed(4)}
        </button>
      </div>

      {/* Trade modal overlay */}
      {side && address && contracts?.VSPToken && contracts?.USDC && (
        <div className="trade-modal-overlay" onClick={() => setSide(null)}>
          <div
            className="trade-modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <TradeModal
              side={side}
              quote={quote}
              walletAddress={address}
              usdcAddress={contracts.USDC}
              vspAddress={contracts.VSPToken}
              onClose={() => setSide(null)}
              refetchBalances={refetchBalances}
            />
            <button className="trade-close-btn" onClick={() => setSide(null)}>
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
