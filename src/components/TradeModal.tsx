import { useState, useEffect } from "react";
import { useAccount, useBalance, useContractRead, useContractWrite, useWaitForTransactionReceipt } from "wagmi";
import erc20Abi from "../abi/erc20.json";

const USDC_ADDRESS = import.meta.env.VITE_USDC_ADDRESS as `0x${string}` | undefined;
const VSP_ADDRESS = "0x0a631331858a547b6372720c033fbf15a17304d4" as `0x${string}`;
const MM_ADDRESS = import.meta.env.VITE_MM_ADDRESS as `0x${string}` | undefined;

export default function TradeModal({
  side,
  quote,
  walletAddress,
  onClose,
  refetchBalances,
}: {
  side: "buy" | "sell";
  quote: { buy_usdc: number; sell_usdc: number };
  walletAddress: string;
  onClose: () => void;
  refetchBalances: () => void;
}) {
  const { chain, isConnected, address } = useAccount();
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numeric = Number(amount) || 0;
  const price = side === "buy" ? quote.buy_usdc : quote.sell_usdc;
  const usdcNeeded = side === "buy" ? Math.floor(numeric * price * 1e6) : 0;
  const vspNeeded = side === "sell" ? Math.floor(numeric * 1e18) : 0;

  if (!isConnected) return <div className="modal error">Wallet not connected</div>;
  if (!address) return <div className="modal error">No wallet address</div>;
  if (!USDC_ADDRESS || !MM_ADDRESS) return <div className="modal error">Missing USDC/MM address in .env</div>;

  if (chain?.id !== 43113) {
    return (
      <div className="modal error">
        <h3>Wrong Network</h3>
        <p>Please switch to Avalanche Fuji Testnet (chain ID 43113)</p>
        <button className="btn" onClick={onClose}>Close</button>
      </div>
    );
  }

  // USDC balance (for buy)
  const { data: usdcBalanceData, refetch: refetchUsdc } = useBalance({
    address,
    token: USDC_ADDRESS,
    watch: true,
  });
  const usdcBalance = usdcBalanceData ? Number(usdcBalanceData.formatted) : 0;

  // VSP balance (for sell)
  const { data: vspBalanceData, refetch: refetchVsp } = useBalance({
    address,
    token: VSP_ADDRESS,
    watch: true,
  });
  const vspBalance = vspBalanceData ? Number(vspBalanceData.formatted) : 0;

  // Allowance check - dynamic token
  const tokenToApprove = side === "buy" ? USDC_ADDRESS : VSP_ADDRESS;
  const amountNeeded = side === "buy" ? usdcNeeded : vspNeeded;

  const { data: allowanceData, refetch: refetchAllowance } = useContractRead({
    address: tokenToApprove,
    abi: erc20Abi,
    functionName: "allowance",
    args: [address, MM_ADDRESS],
    enabled: !!tokenToApprove && !!MM_ADDRESS,
    watch: true,
  });

  const currentAllowance = allowanceData ? Number(allowanceData) : 0;
  const needsApproval = amountNeeded > 0 && currentAllowance < amountNeeded;

  const { writeContract: approve, data: approveTx, isPending: approvePending, error: approveError } = useContractWrite();

  const { isLoading: approveLoading, isSuccess: approveSuccess } = useWaitForTransactionReceipt({
    hash: approveTx?.hash,
  });

  useEffect(() => {
    if (approveSuccess) {
      refetchAllowance();
      console.log("Approval succeeded – allowance refetched");
    }
  }, [approveSuccess, refetchAllowance]);

  async function handleApprove() {
    if (!approve) {
      setError("Wallet not ready");
      return;
    }
    if (amountNeeded <= 0) {
      setError("Amount too small for approval");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const approvalAmount = BigInt(amountNeeded) * 2n;
      approve({
        address: tokenToApprove,
        abi: erc20Abi,
        functionName: "approve",
        args: [MM_ADDRESS, approvalAmount],
      });
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
    if (needsApproval) {
      setError(`Please approve ${side === "buy" ? "USDC" : "VSP"} first`);
      return;
    }
    if (side === "buy" && usdcBalance * 1e6 < usdcNeeded) {
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
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_address: walletAddress,
          vsp_amount: Math.floor(numeric),
          expected_price_usdc: price,
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `Failed (${res.status})`);
      }
      const data = await res.json();
      alert(`${side === "buy" ? "Buy" : "Sell"} successful!`);
      refetchBalances(); // Refresh main screen balances
      onClose();
    } catch (err: any) {
      setError(err.message || "Transaction failed");
    } finally {
      setLoading(false);
    }
  }

  function handleMax() {
    if (side === "buy") {
      const maxVsp = (usdcBalance / price) || 0;
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

        <div style={{ marginTop: 8 }}>
          You will {side === "buy" ? "receive" : "pay"}:{" "}
          <strong>{(side === "buy" ? numeric / price : numeric * price).toFixed(4)}</strong>{" "}
          {side === "buy" ? "VSP" : "USDC"}
        </div>

        <div style={{ marginTop: 8 }}>
          Current {side === "buy" ? "USDC" : "VSP"} allowance: {(currentAllowance / 1e6).toFixed(2)} {side === "buy" ? "USDC" : "VSP"}
        </div>

        {needsApproval && (
          <button
            className="btn btn-warning"
            onClick={handleApprove}
            disabled={approveLoading || approvePending || !approve}
            style={{ marginTop: 12, width: "100%" }}
          >
            {approveLoading || approvePending ? "Approving..." : `Approve ${side === "buy" ? "USDC" : "VSP"}`}
          </button>
        )}

        {approveSuccess && <div className="success" style={{ marginTop: 12 }}>{side === "buy" ? "USDC" : "VSP"} approved!</div>}

        {approveError && <div className="error" style={{ marginTop: 12 }}>
          {approveError.shortMessage || approveError.message || "Approval error"}
        </div>}

        {error && <div className="error" style={{ marginTop: 12 }}>{error}</div>}

        <div className="row" style={{ marginTop: 20, justifyContent: "flex-end", gap: 12 }}>
          <button className="btn" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={loading || needsApproval || !numeric}
          >
            {loading ? "Processing..." : "Confirm"}
          </button>
        </div>

        <button className="trade-close-btn" onClick={onClose}>×</button>
      </div>
    </div>
  );
}
