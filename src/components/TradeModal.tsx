// frontend/src/components/TradeModal.tsx
import React, { useState } from "react";

const TRADE_FEE_BPS = 50; // 0.50%

export default function TradeModal({
  side,
  onClose,
}: {
  side: "buy" | "sell";
  onClose: () => void;
}) {
  const [wallet, setWallet] = useState("");
  const [amount, setAmount] = useState("");

  function submit() {
    alert(
      `[STUB]\n${side.toUpperCase()} ${amount} VSP\nWallet: ${wallet}\nFee: ${TRADE_FEE_BPS / 100}%`
    );
  }

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>{side === "buy" ? "Buy VSP" : "Sell VSP"}</h3>

        <input
          className="input"
          placeholder="Wallet address"
          value={wallet}
          onChange={(e) => setWallet(e.target.value)}
        />

        <input
          className="input"
          placeholder="Amount (VSP)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        <div className="muted">Fee: {TRADE_FEE_BPS / 100}%</div>

        <div className="row">
          <button className="btn btn-primary" onClick={submit}>
            Confirm
          </button>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

