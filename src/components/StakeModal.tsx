// frontend/src/components/StakeModal.tsx
import { useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { useBalance } from "wagmi";
import { FUJI_ADDRESSES } from "../deployments/fuji";

type StakeModalProps = {
  claimId: number;
  side: "support" | "challenge";
  onClose: () => void;
  onStake: (amount: number) => Promise<void>;
};

export default function StakeModal({
  claimId,
  side,
  onClose,
  onStake,
}: StakeModalProps) {
  const { address, isConnected } = useAccount();
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // VSP balance
  const { data: vspBalanceData } = useBalance({
    address,
    token: FUJI_ADDRESSES.VSPToken,
    query: { enabled: Boolean(isConnected && address) },
  });

  const vspBalance = vspBalanceData ? Number(vspBalanceData.formatted) : 0;
  const numericAmount = Number(amount) || 0;

  const handleMax = () => setAmount(vspBalance.toFixed(6));

  const handleSubmit = async () => {
    if (numericAmount <= 0) {
      setError("Amount must be greater than 0");
      return;
    }
    if (numericAmount > vspBalance) {
      setError(
        `Insufficient VSP balance (${vspBalance.toFixed(4)} available).`,
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onStake(numericAmount);
      onClose();
    } catch (e: any) {
      setError(e.shortMessage || e.message || "Stake failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="trade-modal-overlay" onClick={onClose}>
      <div className="trade-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="trade-close-btn" onClick={onClose}>
          ×
        </button>

        <h3>Stake on Claim #{claimId}</h3>
        <p>
          Side:{" "}
          <strong style={{ color: side === "support" ? "#00cc44" : "#ff4444" }}>
            {side.charAt(0).toUpperCase() + side.slice(1)}
          </strong>
        </p>

        <div style={{ margin: "16px 0" }}>
          <label style={{ display: "block", marginBottom: 6, fontSize: 13 }}>
            Your VSP balance: <strong>{vspBalance.toFixed(4)}</strong>
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              className="input"
              type="number"
              placeholder="Amount to stake (VSP)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="0"
              step="0.0001"
              disabled={loading}
              style={{ flex: 1 }}
            />
            <button className="btn" onClick={handleMax} disabled={loading}>
              Max
            </button>
          </div>
        </div>

        {numericAmount > 0 && (
          <div style={{ fontSize: 13, color: "#555", marginBottom: 12 }}>
            Staking {numericAmount.toFixed(4)} VSP on <strong>{side}</strong>
          </div>
        )}

        {error && (
          <div className="error" style={{ margin: "12px 0" }}>
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
            onClick={handleSubmit}
            disabled={
              loading || numericAmount <= 0 || numericAmount > vspBalance
            }
          >
            {loading ? "Staking…" : "Stake"}
          </button>
        </div>
      </div>
    </div>
  );
}
