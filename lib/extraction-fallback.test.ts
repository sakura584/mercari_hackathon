import { describe, expect, it } from "vitest";
import { FALLBACK_EXTRACTED_ITEMS } from "./extraction-fallback";

describe("FALLBACK_EXTRACTED_ITEMS", () => {
  it("provides at least 3 sample items with title and category", () => {
    expect(FALLBACK_EXTRACTED_ITEMS.length).toBeGreaterThanOrEqual(3);
    for (const item of FALLBACK_EXTRACTED_ITEMS) {
      expect(item.title).toBeTruthy();
      expect(item.category).toBeTruthy();
    }
  });
});
