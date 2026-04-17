// frontend/src/components/article/theme.ts
// Shared constants, color helpers, and CSS injection for article components.

export const C = {
  green: "#059669",
  red: "#dc2626",
  gray: "#6b7280",
  gl: "#f3f4f6",
  gb: "#e5e7eb",
  text: "#111827",
  muted: "#9ca3af",
  white: "#fff",
  blue: "#3b82f6",
  bbg: "rgba(59,130,246,0.07)",
};

/** Coerce to finite number, default 0 */
export const n = (x: any): number =>
  typeof x === "number" && isFinite(x) ? x : 0;

/** Format with leading sign: "+12" / "-3" / "+0" */
export const fmt = (x: number): string => (x > 0 ? "+" : "") + x.toFixed(0);

/** Verity-score color: green / red / neutral */
export const vc = (x: number): string =>
  x > 5 ? C.green : x < -5 ? C.red : C.gray;

/** Verity-score background tint */
export const vb = (x: number): string =>
  x <= 0
    ? "transparent"
    : `rgba(16,185,80,${Math.min(0.04 + (x / 100) * 0.12, 0.16)})`;

const SID = "av-css";
export function injectCSS() {
  if (document.getElementById(SID)) return;
  const s = document.createElement("style");
  s.id = SID;
  s.textContent = `
    .av-s{cursor:pointer;border-radius:3px;padding:0 1px;transition:background .12s}
    .av-s:hover{background:rgba(59,130,246,0.06)!important}
    .av-plus{opacity:0;transition:opacity .12s;cursor:pointer;vertical-align:middle}
    .av-zone:hover .av-plus{opacity:1!important}
    .av-plus:hover{opacity:1!important}
    @keyframes vs-spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
  `;
  document.head.appendChild(s);
}
