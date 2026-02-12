// frontend/src/WalletDialog.tsx
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";

const CHAIN_LABEL = "Avalanche Fuji Testnet";

export default function WalletDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { isConnected } = useAccount();

  if (!open) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal" style={{ width: 420 }}>
        <h3>Wallet</h3>

        <p className="muted">
          Network: <strong>{CHAIN_LABEL}</strong>
        </p>

        <div className="card">
          <h4>Connect existing wallet</h4>
          <ConnectButton />
        </div>

        <div className="card">
          <h4>Create a new wallet</h4>
          <ol className="muted">
            <li>Install MetaMask or compatible wallet</li>
            <li>Create a new wallet &amp; save recovery phrase</li>
            <li>Switch to {CHAIN_LABEL}</li>
            <li>Click “Connect” above</li>
          </ol>
        </div>

        <div className="row" style={{ justifyContent: "space-between" }}>
          <span className="muted">
            {isConnected ? "Connected ✅" : "Not connected"}
          </span>
          <button className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

