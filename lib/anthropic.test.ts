import { describe, expect, it, vi, beforeEach } from "vitest";

describe("getAnthropicClient", () => {
  beforeEach(() => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
  });

  it("throws if ANTHROPIC_API_KEY is not set", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const { getAnthropicClient } = await import("./anthropic");
    expect(() => getAnthropicClient()).toThrow("ANTHROPIC_API_KEY is not set");
  });

  it("returns a client when ANTHROPIC_API_KEY is set", async () => {
    const { getAnthropicClient } = await import("./anthropic");
    expect(getAnthropicClient()).toBeDefined();
  });
});
