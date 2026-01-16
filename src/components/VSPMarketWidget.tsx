import { ConnectButton } from "@rainbow-me/rainbowkit";

export default function VSPMarketWidget() {
  const price = 1.42;

  return (
    <div className="vsp-mini">
      <ConnectButton
        accountStatus="address"
        chainStatus="name"
        showBalance={false}
      />

      <button className="btn btn-primary">Buy</button>
      <button className="btn">Sell</button>

      <span className="vsp-price">
        {price.toFixed(2)} VSP / USDC
      </span>
    </div>
  );
}

