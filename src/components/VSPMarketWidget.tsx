import { useEffect, useState } from "react";
import { useAccount, useBalance, useChainId } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import TradeModal from "./TradeModal";
import { useContracts } from "../contracts";
import { getTokenAddresses } from "../web3/tokenAddresses";

type MMQuote = {
  buy_usdc: number;
  sell_usdc: number;
};

export default function VSPMarketWidget() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  const { data: contracts, isLoading: contractsLoading, error: contractsError } = useContracts();

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

        if (typeof data.buy_usdc !== "number" || typeof data.sell_usdc !== "number") {
          throw new Error("Malformed quote");
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
      }
    }

    fetchQuote();
    const id = setInterval(fetchQuote, 5000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  // VSP balance + refetch
  const {
    data: vspBalanceData,
    refetch: refetchVsp,
  } = useBalance({
    address,
    token: contracts?.VSPToken,
    enabled: Boolean(isConnected && address && contracts?.VSPToken),
    watch: true,
  });

  // USDC balance + refetch (using getTokenAddresses fallback)
  const {
    data: usdcBalanceData,
    refetch: refetchUsdc,
  } = useBalance({
    address,
    token: getTokenAddresses().USDC,
    enabled: Boolean(isConnected && address),
    watch: true,
  });

  // Function to refetch both balances after successful trade
  const refetchBalances = () => {
    refetchVsp();
    refetchUsdc();
    console.log("Balances refetched after trade");
  };

  if (contractsLoading) {
    return <div className="muted">Loading contracts…</div>;
  }

  if (contractsError) {
    return <div className="card error">Contracts error: {contractsError.message}</div>;
  }

  if (error) {
    return <div className="card error">Error: {error}</div>;
  }

  if (!quote) {
    return <div className="muted">Loading VSP price…</div>;
  }

  return (
    <>
      <div className="card">
        {/* Wallet */}
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <ConnectButton />
        </div>

        {/* Balances */}
        {isConnected && (
          <div className="row" style={{ marginTop: 8, gap: 12 }}>
            <span className="badge">
              VSP: {vspBalanceData ? Number(vspBalanceData.formatted).toFixed(4) : "0.0000"}
            </span>
            <span className="badge">
              USDC: {usdcBalanceData ? Number(usdcBalanceData.formatted).toFixed(2) : "0.00"}
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="row" style={{ marginTop: 10, gap: 12 }}>
          <button
            className="btn btn-primary"
            disabled={!isConnected || !contracts?.VSPToken}
            onClick={() => setSide("buy")}
          >
            Buy @ {quote.buy_usdc.toFixed(4)} USDC
          </button>

          <button
            className="btn"
            disabled={!isConnected || !contracts?.VSPToken}
            onClick={() => setSide("sell")}
          >
            Sell @ {quote.sell_usdc.toFixed(4)} USDC
          </button>
        </div>
      </div>

      {/* Trade modal – now with refetchBalances prop */}
      {side && address && contracts?.VSPToken && (
        <TradeModal
          side={side}
          quote={quote}
          walletAddress={address}
          onClose={() => setSide(null)}
          refetchBalances={refetchBalances}  // ← now properly defined & passed
        />
      )}
    </>
  );
}
