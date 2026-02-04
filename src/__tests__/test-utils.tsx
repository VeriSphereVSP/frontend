import { ReactNode } from "react";

export function renderWithProviders(ui: ReactNode) {
  return <Web3Provider>{ui}</Web3Provider>;
}

