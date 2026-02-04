import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

/**
 * Step 1: mock wagmi BEFORE loading App
 */
vi.mock("wagmi", () => ({
  useAccount: () => ({
    address: undefined,
    isConnected: false,
  }),
}));

/**
 * Step 2: mock the widget BEFORE loading App
 */
vi.mock("../components/VSPMarketWidget", () => ({
  default: () => <div data-testid="vsp-market-widget" />,
}));

describe("<App />", () => {
  it("renders and submits to /api/interpret", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        return new Response(
          JSON.stringify({ kind: "non_actionable", message: "ok" }),
          { status: 200 }
        );
      }) as any
    );

    /**
     * Step 3: dynamically import App AFTER mocks
     */
    const { default: App } = await import("../App");

    render(<App />);

    const textarea = screen.getByPlaceholderText(
      /state a claim.*search a topic/i
    );

    fireEvent.change(textarea, { target: { value: "Hello" } });

    const btn = screen.getByRole("button", { name: /submit/i });
    fireEvent.click(btn);

    expect(await screen.findByText(/ok/i)).toBeInTheDocument();
  });
});

