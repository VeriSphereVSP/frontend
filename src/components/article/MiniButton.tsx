// frontend/src/components/article/MiniButton.tsx
import { C } from "./theme";

/** Tiny styled button with color variants. */
export default function MiniButton({
  children,
  onClick,
  dis,
  green,
  red,
  ghost,
  sec,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  dis?: boolean;
  green?: boolean;
  red?: boolean;
  ghost?: boolean;
  sec?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={dis}
      style={{
        fontSize: 10,
        fontWeight: 600,
        cursor: "pointer",
        padding: "2px 7px",
        borderRadius: 4,
        background: ghost
          ? "transparent"
          : green
            ? "rgba(16,185,80,.1)"
            : red
              ? "rgba(220,50,50,.08)"
              : sec
                ? C.gl
                : C.blue,
        color: ghost
          ? C.gray
          : green
            ? C.green
            : red
              ? C.red
              : sec
                ? C.text
                : C.white,
        border: green
          ? `1px solid ${C.green}`
          : red
            ? `1px solid ${C.red}`
            : sec
              ? `1px solid ${C.gb}`
              : "none",
        opacity: dis ? 0.5 : 1,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}
