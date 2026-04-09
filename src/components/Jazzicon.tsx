import { useEffect, useRef } from "react";
import jazzicon from "@metamask/jazzicon";

// Real MetaMask jazzicon — produces SVG geometric icons
export default function Jazzicon({ address, size = 16 }: { address: string; size?: number }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || !address) return;
    // Seed from first 10 hex chars of address (matches MetaMask)
    const seed = parseInt(address.toLowerCase().replace(/^0x/, "").slice(0, 10), 16);
    const icon = jazzicon(size, seed);
    // Clear previous and append new icon
    ref.current.innerHTML = "";
    ref.current.appendChild(icon);
  }, [address, size]);

  return (
    <div
      ref={ref}
      style={{
        width: size,
        height: size,
        display: "inline-block",
        verticalAlign: "middle",
        flexShrink: 0,
      }}
    />
  );
}
