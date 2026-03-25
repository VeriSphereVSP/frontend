import { useEffect, useRef } from "react";

// Simple jazzicon using canvas (no external dependency needed)
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return Math.abs(hash);
}

const COLORS = [
  "#01888C", "#FC7500", "#034F5D", "#F73F01", "#FC1960",
  "#C7144C", "#F3C100", "#1598F2", "#2465E1", "#F19E02",
];

export default function Jazzicon({ address, size = 16 }: { address: string; size?: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !address) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const seed = hashCode(address.toLowerCase());
    const colors = [...COLORS];

    // Shuffle colors based on seed
    for (let i = colors.length - 1; i > 0; i--) {
      const j = (seed + i * 7) % (i + 1);
      [colors[i], colors[j]] = [colors[j], colors[i]];
    }

    // Background
    ctx.fillStyle = colors[0];
    ctx.fillRect(0, 0, size, size);

    // Draw shapes
    const shapeCount = 3;
    for (let i = 0; i < shapeCount; i++) {
      ctx.fillStyle = colors[(i + 1) % colors.length];
      const x = ((seed * (i + 1) * 13) % size);
      const y = ((seed * (i + 1) * 17) % size);
      const w = size * 0.4 + ((seed * (i + 3)) % (size * 0.3));
      const h = size * 0.4 + ((seed * (i + 5)) % (size * 0.3));
      ctx.beginPath();
      ctx.arc(x, y, w / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [address, size]);

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
      }}
      title={address}
    />
  );
}
