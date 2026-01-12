import React, { useState } from "react";

export default function VSPMarketWidget() {
  const [open, setOpen] = useState<null | "buy" | "sell">(null);
  const price = 1.42; // STUB — fetched from MM later

  return (
    <>
      {/* Compact header widget */}
      <div className="vsp-mini">
        <button className="btn btn-primary" onClick={() => setOpen("buy")}>
          Buy
        </button>
        <button className="btn" onClick={() => setOpen("sell")}>
          Sell
        </button>
        <span className="vsp-price">{price.toFixed(2)} VSP / USDC</span>
      </div>

      {/* Modal */}
      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{open === "buy" ? "Buy VSP" : "Sell VSP"}</h3>

            <div className="modal-price">
              Price: {price.toFixed(4)} USDC per VSP
            </div>

            <input className="input" placeholder="Wallet address" />
            <input className="input" placeholder="Amount (VSP)" />

            <button className="btn btn-primary">
              {open === "buy" ? "Buy VSP" : "Sell VSP"}
            </button>

            <div className="muted" style={{ fontSize: 12 }}>
              Includes protocol + market maker fees.
            </div>
          </div>
        </div>
      )}
    </>
  );
}

