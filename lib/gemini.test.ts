import { beforeEach, describe, expect, it, vi } from "vitest";

describe("getGeminiClient", () => {
  beforeEach(() => vi.stubEnv("GEMINI_API_KEY", "test-key"));

  it("throws if GEMINI_API_KEY is not set", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const { getGeminiClient } = await import("./gemini");
    expect(() => getGeminiClient()).toThrow("GEMINI_API_KEY is not set");
  });

  it("returns a client when GEMINI_API_KEY is set", async () => {
    const { getGeminiClient } = await import("./gemini");
    expect(getGeminiClient()).toBeDefined();
  });
});
