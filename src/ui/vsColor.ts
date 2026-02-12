export function evsToBackground(evs?: number): string {
  if (evs === undefined || isNaN(evs)) {
    return "#ffffff";
  }

  const v = Math.max(-100, Math.min(100, evs)) / 100;

  // red ↔ white ↔ green
  const red = v < 0 ? 255 : Math.round(255 * (1 - v));
  const green = v > 0 ? 255 : Math.round(255 * (1 + v));
  const blue = 255;

  return `rgb(${red}, ${green}, ${blue})`;
}

