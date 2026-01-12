import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import App from "../App";

describe("<App />", () => {
  it("renders and submits to /api/interpret", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      return new Response(JSON.stringify({ kind: "non_actionable", message: "ok" }), { status: 200 });
    }) as any);

    render(<App />);
    const textarea = screen.getByPlaceholderText(
      /state a claim.*search a topic/i
    );

    fireEvent.change(textarea, { target: { value: "Hello" } });

    const btn = screen.getByRole("button", { name: /submit/i });
    fireEvent.click(btn);

    // "Thinking…" appears while fetch runs
    expect(await screen.findByText(/ok/i)).toBeInTheDocument();
  });
});
