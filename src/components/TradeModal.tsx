// frontend/src/components/TradeModal.tsx
import { fireToast, friendlyError } from "../utils/errorMessages";
import { useState, useEffect } from "react";
import { useAccount, useBalance, useWalletClient } from "wagmi";

type MMQuote = {
  mid_price_usd: number;
  buy_price_usd: number;
  sell_price_usd: number;
  floor_price_usd: number;
};

type FillPreview = {
  side: string;
  qty_vsp: number;
  total_usdc: number;
  avg_price_usd: number;
} | null;

// EIP-2612 permit domain & types for signing
const PERMIT_TYPES = {
  Permit: [
    { name: "owner", type: "address" },
    { name: "spender", type: "address" },
    { name: "value", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

export default function TradeModal({
  side,
  quote,
  walletAddress,
  usdcAddress,
  vspAddress,
  onClose,
  refetchBalances,
}: {
  side: "buy" | "sell";
  quote: MMQuote;
  walletAddress: string;
  usdcAddress: `0x${string}`;
  vspAddress: `0x${string}`;
  onClose: () => void;
  refetchBalances: () => void;
}) {
  const { chain, isConnected, address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<FillPreview>(null);
  const [status, setStatus] = useState<string | null>(null);

  const MM_ADDRESS = import.meta.env.VITE_MM_ADDRESS as
    | `0x${string}`
    | undefined;

  const numeric = Number(amount) || 0;
  const spotPrice = side === "buy" ? quote.buy_price_usd : quote.sell_price_usd;

  if (!isConnected)
    return <div className="modal error">Wallet not connected</div>;
  if (!address) return <div className="modal error">No wallet address</div>;
  if (!MM_ADDRESS)
    return <div className="modal error">Missing MM_ADDRESS in .env</div>;

  if (chain?.id !== 43113) {
    return (
      <div className="modal error">
        <h3>Wrong Network</h3>
        <p>Please switch to Avalanche Fuji Testnet (chain ID 43113)</p>
        <button className="btn" onClick={onClose}>
          Close
        </button>
      </div>
    );
  }

  // USDC balance (for buy)
  const { data: usdcBalanceData, refetch: refetchUsdc } = useBalance({
    address,
    token: usdcAddress,
    query: { enabled: Boolean(address && usdcAddress) },
  });
  const usdcBalance = usdcBalanceData ? Number(usdcBalanceData.formatted) : 0;

  // VSP balance (for sell)
  const { data: vspBalanceData, refetch: refetchVsp } = useBalance({
    address,
    token: vspAddress,
    query: { enabled: Boolean(address && vspAddress) },
  });
  const vspBalance = vspBalanceData ? Number(vspBalanceData.formatted) : 0;

  // Clear preview when amount changes
  useEffect(() => {
    setPreview(null);
    setError(null);
    setStatus(null);
  }, [amount, side]);

  async function handlePreview() {
    if (numeric <= 0) {
      setError("Amount must be greater than 0");
      return;
    }
    try {
      setPreviewing(true);
      setError(null);
      const res = await fetch("/api/mm/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ side, qty_vsp: numeric }),
      });
      if (!res.ok)
        throw new Error((await res.text()) || `Preview failed (${res.status})`);
      setPreview(await res.json());
    } catch (err: any) {
      setError(err.message || "Preview failed");
    } finally {
      setPreviewing(false);
    }
  }

  async function handleConfirm() {
    if (numeric <= 0) {
      setError("Amount must be greater than 0");
      return;
    }
    if (!preview) {
      setError("Please preview the fill first");
      return;
    }
    if (!walletClient) {
      setError("Wallet not available");
      return;
    }

    if (side === "buy" && usdcBalance < preview.total_usdc) {
      setError("Insufficient USDC balance");
      return;
    }
    if (side === "sell" && vspBalance < numeric) {
      setError("Insufficient VSP balance");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // ── Step 1: Sign EIP-2612 permit ──
      const tokenAddress = side === "buy" ? usdcAddress : vspAddress;
      const tokenName = side === "buy" ? "USD Coin" : "VeriSphere";
      const tokenVersion = side === "buy" ? "2" : "1";
      const tokenKey = side === "buy" ? "usdc" : "vsp";

      // Calculate permit value with buffer
      let permitValue: bigint;
      if (side === "buy") {
        // USDC: 6 decimals, add 5% buffer
        permitValue = BigInt(Math.ceil(preview.total_usdc * 1.05 * 1_000_000));
      } else {
        // VSP: 18 decimals, add 5% buffer
        permitValue = BigInt(Math.ceil(numeric * 1.05 * 1e18));
      }

      const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour

      setStatus("Fetching permit nonce…");

      // Get nonce from backend
      const nonceRes = await fetch(
        `/api/mm/permit-nonce/${tokenKey}/${address}`,
      );
      if (!nonceRes.ok) throw new Error("Failed to fetch permit nonce");
      const { nonce } = await nonceRes.json();

      setStatus("Please sign the permit in your wallet…");

      // Build EIP-712 domain
      const domain = {
        name: tokenName,
        version: tokenVersion,
        chainId: chain!.id,
        verifyingContract: tokenAddress,
      };

      // Sign the permit
      const signature = await walletClient.signTypedData({
        domain,
        types: PERMIT_TYPES,
        primaryType: "Permit",
        message: {
          owner: address,
          spender: MM_ADDRESS,
          value: permitValue,
          nonce: BigInt(nonce),
          deadline: BigInt(deadline),
        },
      });

      // Split signature into v, r, s
      const r = "0x" + signature.slice(2, 66);
      const s = "0x" + signature.slice(66, 130);
      const v = parseInt(signature.slice(130, 132), 16);

      // ── Step 2: Send trade request with permit ──
      setStatus("Executing trade…");

      const slippageBuffer = side === "buy" ? 1.01 : 0.99;
      const maxTotalUsdc = preview.total_usdc * slippageBuffer;

      const endpoint = side === "buy" ? "/api/mm/buy" : "/api/mm/sell";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_address: walletAddress,
          qty_vsp: numeric,
          max_total_usdc: maxTotalUsdc,
          permit: {
            deadline,
            v,
            r,
            s,
            value: Number(permitValue),
          },
        }),
      });

      if (!res.ok)
        throw new Error((await res.text()) || `Trade failed (${res.status})`);

      const result = await res.json();
      setStatus(null);

      alert(
        `${side === "buy" ? "Bought" : "Sold"} ${result.qty_vsp} VSP ` +
          `for ${result.total_usdc.toFixed(2)} USDC ` +
          `(avg ${result.avg_price_usd.toFixed(4)}/VSP)`,
      );

      refetchBalances();
      refetchUsdc();
      refetchVsp();
      window.dispatchEvent(new Event("verisphere:data-changed"));
      onClose();
    } catch (err: any) {
      setStatus(null);
      // User rejected signature
      if (
        err.message?.includes("rejected") ||
        err.message?.includes("denied")
      ) {
        setError("Signature rejected");
      } else {
        setError(err.message || "Transaction failed");
      }
    } finally {
      setLoading(false);
    }
  }

  function handleMax() {
    if (side === "buy") {
      const maxVsp = usdcBalance / spotPrice || 0;
      setAmount(maxVsp.toFixed(4));
    } else {
      setAmount(vspBalance.toFixed(4));
    }
  }

  return (
    <div className="trade-modal-overlay" onClick={onClose}>
      <div className="trade-modal-content" onClick={(e) => e.stopPropagation()}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <h3 style={{ margin: 0 }}>
            {side === "buy" ? "Buy VSP" : "Sell VSP"}
          </h3>
          <button
            onClick={onClose}
            style={{
              border: "none",
              background: "none",
              fontSize: 20,
              cursor: "pointer",
              color: "#6b7280",
            }}
          >
            ×
          </button>
        </div>

        <div style={{ marginBottom: 8, fontSize: 13, color: "#6b7280" }}>
          Connected chain: {chain?.name || "Unknown"} (ID: {chain?.id || "—"})
        </div>

        <div style={{ marginBottom: 12, fontSize: 13 }}>
          {side === "buy" ? "Your USDC balance" : "Your VSP balance"}:{" "}
          <strong>
            {side === "buy" ? usdcBalance.toFixed(2) : vspBalance.toFixed(4)}
          </strong>
        </div>

        <div style={{ marginBottom: 4, fontSize: 12, color: "#9ca3af" }}>
          Liquidation floor: ${quote.floor_price_usd.toFixed(4)}
        </div>

        {/* Amount input */}
        <div style={{ marginBottom: 8 }}>
          <input
            type="number"
            min="0"
            step="any"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={side === "buy" ? "VSP to buy" : "VSP to sell"}
            className="input"
            style={{ width: "100%", marginBottom: 4 }}
          />
          <button
            className="btn"
            onClick={handleMax}
            style={{ fontSize: 12, padding: "4px 10px" }}
          >
            Max
          </button>
        </div>

        {/* Preview button */}
        <button
          className="btn"
          onClick={handlePreview}
          disabled={previewing || numeric <= 0}
          style={{ width: "100%", marginBottom: 8 }}
        >
          {previewing ? "Calculating…" : "Preview Fill"}
        </button>

        {/* Preview result */}
        {preview && (
          <div
            style={{
              marginBottom: 8,
              padding: 10,
              background: "#f8fafc",
              borderRadius: 8,
              fontSize: 13,
            }}
          >
            <div>
              Estimated {side === "buy" ? "cost" : "proceeds"}:{" "}
              <strong>~{preview.total_usdc.toFixed(2)} USDC</strong>
            </div>
            <div style={{ fontSize: 11, color: "#6b7280" }}>
              Avg price: ${preview.avg_price_usd.toFixed(4)}/VSP
            </div>
          </div>
        )}

        {/* Status */}
        {status && (
          <div
            style={{
              marginBottom: 8,
              padding: 8,
              background: "#eff6ff",
              borderRadius: 6,
              fontSize: 12,
              color: "#2563eb",
              textAlign: "center",
            }}
          >
            {status}
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            style={{
              marginBottom: 8,
              padding: 8,
              background: "#fef2f2",
              borderRadius: 6,
              fontSize: 12,
              color: "#dc2626",
            }}
          >
            {error}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={onClose} style={{ flex: 1 }}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={loading || !preview || numeric <= 0}
            style={{ flex: 1 }}
          >
            {loading
              ? "Processing…"
              : `${side === "buy" ? "Buy" : "Sell"} ${numeric > 0 ? numeric + " VSP" : ""}`}
          </button>
        </div>

        {/* Gasless note */}
        <div
          style={{
            marginTop: 8,
            fontSize: 10,
            color: "#9ca3af",
            textAlign: "center",
          }}
        >
          No gas required — you only sign a permit message.
        </div>
      </div>
    </div>
  );
}
