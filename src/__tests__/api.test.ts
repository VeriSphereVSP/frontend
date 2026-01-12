import { describe, expect, it, vi, beforeEach } from "vitest";
import { interpret } from "../api";

describe("api.interpret", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns parsed JSON on success", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      return new Response(JSON.stringify({ kind: "non_actionable", message: "hi" }), { status: 200 });
    }) as any);

    const r = await interpret("hello");
    expect(r.kind).toBe("non_actionable");
  });

  it("throws on non-200", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      return new Response("bad", { status: 500 });
    }) as any);

    await expect(interpret("x")).rejects.toThrow(/bad/);
  });
});
