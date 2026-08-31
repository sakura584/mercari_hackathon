import { describe, expect, it, vi, afterEach } from "vitest";
import { estimatePrice, PRICE_RANGES } from "./pricing";

describe("estimatePrice", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a value within the configured range for a known category", () => {
    const price = estimatePrice("clothing_tshirt");
    const range = PRICE_RANGES.clothing_tshirt;
    expect(price).toBeGreaterThanOrEqual(range.min);
    expect(price).toBeLessThanOrEqual(range.max);
  });

  it("is deterministic-ish but not always the same value", () => {
    const samples = new Set(
      Array.from({ length: 20 }, () => estimatePrice("clothing_tshirt"))
    );
    expect(samples.size).toBeGreaterThan(1);
  });

  it("falls back to the default range for an unknown category", () => {
    const price = estimatePrice("totally_unknown_category");
    const range = PRICE_RANGES.default;
    expect(price).toBeGreaterThanOrEqual(range.min);
    expect(price).toBeLessThanOrEqual(range.max);
  });
});
