// frontend/src/components/TradeModal.tsx
import { useState, useEffect } from "react";
import {
  useAccount,
  useBalance,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";

const ERC20_ABI = [
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

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
  const { writeContractAsync } = useWriteContract();
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<FillPreview>(null);
  const [approveTxHash, setApproveTxHash] = useState<`0x${string}` | null>(
    null,
  );

  const USDC_ADDRESS = usdcAddress;
  const VSP_ADDRESS = vspAddress;
  const MM_ADDRESS = import.meta.env.VITE_MM_ADDRESS as
    | `0x${string}`
    | undefined;

  const numeric = Number(amount) || 0;
  // Spot price for display and allowance estimation
  const spotPrice = side === "buy" ? quote.buy_price_usd : quote.sell_price_usd;

  // For approval, use preview total if available, otherwise estimate from spot
  const estimatedUsdc = preview ? preview.total_usdc : numeric * spotPrice;
  const usdcNeeded = side === "buy" ? Math.ceil(estimatedUsdc * 1e6) : 0;
  const vspNeeded = side === "sell" ? Math.floor(numeric * 1e18) : 0;

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
    token: USDC_ADDRESS,
    query: { enabled: Boolean(address && USDC_ADDRESS) },
  });
  const usdcBalance = usdcBalanceData ? Number(usdcBalanceData.formatted) : 0;

  // VSP balance (for sell)
  const { data: vspBalanceData, refetch: refetchVsp } = useBalance({
    address,
    token: VSP_ADDRESS,
    query: { enabled: Boolean(address && VSP_ADDRESS) },
  });
  const vspBalance = vspBalanceData ? Number(vspBalanceData.formatted) : 0;

  // Allowance check
  const tokenToApprove = side === "buy" ? USDC_ADDRESS : VSP_ADDRESS;
  const amountNeeded = side === "buy" ? usdcNeeded : vspNeeded;

  const { data: allowanceData, refetch: refetchAllowance } = useReadContract({
    address: tokenToApprove,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [address, MM_ADDRESS],
    query: { enabled: Boolean(address && MM_ADDRESS) },
  });

  const currentAllowance = allowanceData ? Number(allowanceData) : 0;
  const needsApproval = amountNeeded > 0 && currentAllowance < amountNeeded;

  const { isLoading: approveLoading, isSuccess: approveSuccess } =
    useWaitForTransactionReceipt({
      hash: approveTxHash || undefined,
    });

  useEffect(() => {
    if (approveSuccess) {
      refetchAllowance();
      console.log("Approval succeeded – allowance refetched");
    }
  }, [approveSuccess, refetchAllowance]);

  // Clear preview when amount changes
  useEffect(() => {
    setPreview(null);
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
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `Preview failed (${res.status})`);
      }
      const data = await res.json();
      setPreview(data);
    } catch (err: any) {
      setError(err.message || "Preview failed");
    } finally {
      setPreviewing(false);
    }
  }

  async function handleApprove() {
    if (amountNeeded <= 0) {
      setError("Amount too small for approval");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const approvalAmount = BigInt(amountNeeded) * 2n;
      const hash = await writeContractAsync({
        address: tokenToApprove,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [MM_ADDRESS!, approvalAmount],
      });
      setApproveTxHash(hash);
    } catch (err: any) {
      setError(err.shortMessage || err.message || "Approval failed");
    } finally {
      setLoading(false);
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
    if (needsApproval) {
      setError(`Please approve ${side === "buy" ? "USDC" : "VSP"} first`);
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
      const endpoint = side === "buy" ? "/api/mm/buy" : "/api/mm/sell";
      // For buys: max_total_usdc is the ceiling the user will pay (add 1% slippage buffer)
      // For sells: max_total_usdc is the floor the user will accept (subtract 1% slippage buffer)
      const slippageBuffer = side === "buy" ? 1.01 : 0.99;
      const maxTotalUsdc = preview.total_usdc * slippageBuffer;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_address: walletAddress,
          qty_vsp: numeric,
          max_total_usdc: maxTotalUsdc,
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `Failed (${res.status})`);
      }
      const result = await res.json();
      alert(
        `${side === "buy" ? "Bought" : "Sold"} ${result.qty_vsp} VSP ` +
          `for ${result.total_usdc.toFixed(2)} USDC ` +
          `(avg ${result.avg_price_usd.toFixed(4)}/VSP)`,
      );
      refetchBalances();
      refetchUsdc();
      refetchVsp();
      onClose();
    } catch (err: any) {
      setError(err.message || "Transaction failed");
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
        <h3>{side === "buy" ? "Buy VSP" : "Sell VSP"}</h3>

        <div style={{ marginBottom: 12 }}>
          Connected chain: {chain?.name || "Unknown"} (ID: {chain?.id || "—"})
        </div>

        <div style={{ marginBottom: 12 }}>
          {side === "buy" ? "Your USDC balance" : "Your VSP balance"}:{" "}
          {side === "buy" ? usdcBalance.toFixed(2) : vspBalance.toFixed(4)}
        </div>

        <div style={{ marginBottom: 8, fontSize: 12, color: "#888" }}>
          Liquidation floor: ${quote.floor_price_usd.toFixed(4)}
        </div>

        <input
          className="input"
          type="number"
          placeholder="Amount of VSP"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          min="0"
          step="0.01"
        />

        <button className="btn" onClick={handleMax} style={{ marginLeft: 12 }}>
          Max
        </button>

        {/* Preview section */}
        {!preview && numeric > 0 && (
          <button
            className="btn btn-secondary"
            onClick={handlePreview}
            disabled={previewing}
            style={{ marginTop: 8, width: "100%" }}
          >
            {previewing ? "Calculating…" : "Preview Fill"}
          </button>
        )}

        {preview && (
          <div
            style={{
              marginTop: 8,
              padding: 12,
              background: "rgba(0,0,0,0.05)",
              borderRadius: 8,
            }}
          >
            <div>
              You will {side === "buy" ? "pay" : "receive"}:{" "}
              <strong>{preview.total_usdc.toFixed(2)} USDC</strong>
            </div>
            <div style={{ fontSize: 12, color: "#666" }}>
              Average price: ${preview.avg_price_usd.toFixed(4)} / VSP (spot: $
              {spotPrice.toFixed(4)})
            </div>
          </div>
        )}

        {!preview && numeric > 0 && (
          <div style={{ marginTop: 8, fontSize: 12, color: "#888" }}>
            Estimated (spot): ~{(numeric * spotPrice).toFixed(2)} USDC
          </div>
        )}

        <div style={{ marginTop: 8, fontSize: 12, color: "#888" }}>
          Current {side === "buy" ? "USDC" : "VSP"} allowance:{" "}
          {(currentAllowance / (side === "buy" ? 1e6 : 1e18)).toFixed(2)}
        </div>

        {needsApproval && (
          <button
            className="btn btn-warning"
            onClick={handleApprove}
            disabled={loading || approveLoading}
            style={{ marginTop: 12, width: "100%" }}
          >
            {loading || approveLoading
              ? "Approving..."
              : `Approve ${side === "buy" ? "USDC" : "VSP"}`}
          </button>
        )}

        {approveSuccess && (
          <div className="success" style={{ marginTop: 12 }}>
            {side === "buy" ? "USDC" : "VSP"} approved!
          </div>
        )}

        {error && (
          <div className="error" style={{ marginTop: 12 }}>
            {error}
          </div>
        )}

        <div
          className="row"
          style={{ marginTop: 20, justifyContent: "flex-end", gap: 12 }}
        >
          <button className="btn" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={loading || needsApproval || !numeric || !preview}
          >
            {loading ? "Processing..." : "Confirm"}
          </button>
        </div>

        <button className="trade-close-btn" onClick={onClose}>
          ×
        </button>
      </div>
    </div>
  );
}
