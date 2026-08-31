import { describe, expect, it } from "vitest";
import { applyStatePatch, initialReflectionState } from "./reflection-state";
import type { ReflectionState } from "./types";

describe("initialReflectionState", () => {
  it("creates an empty in_progress state with turnCount 0", () => {
    const state = initialReflectionState("item_001", "サークルTシャツ");
    expect(state).toEqual<ReflectionState>({
      itemId: "item_001",
      itemName: "サークルTシャツ",
      attachmentTypes: [],
      reasonsToKeep: [],
      reasonsToLetGo: [],
      unresolved: [],
      turnCount: 0,
      status: "in_progress",
    });
  });
});

describe("applyStatePatch", () => {
  const base: ReflectionState = {
    itemId: "item_001",
    itemName: "サークルTシャツ",
    attachmentTypes: ["memory"],
    reasonsToKeep: ["サークル最後の大会で着た"],
    reasonsToLetGo: [],
    unresolved: [],
    turnCount: 1,
    status: "in_progress",
  };

  it("merges array fields without duplicates", () => {
    const next = applyStatePatch(base, {
      attachmentTypes: ["memory", "identity"],
      reasonsToKeep: ["サークル最後の大会で着た", "同期からの寄せ書きがある"],
    });
    expect(next.attachmentTypes).toEqual(["memory", "identity"]);
    expect(next.reasonsToKeep).toEqual([
      "サークル最後の大会で着た",
      "同期からの寄せ書きがある",
    ]);
  });

  it("overwrites scalar fields when patch provides them", () => {
    const next = applyStatePatch(base, { memoryToPreserve: "最後の大会で優勝したこと" });
    expect(next.memoryToPreserve).toBe("最後の大会で優勝したこと");
  });

  it("keeps existing scalar fields when patch omits them", () => {
    const withMemory = applyStatePatch(base, { memoryToPreserve: "優勝したこと" });
    const next = applyStatePatch(withMemory, { reasonsToLetGo: ["今後着ない"] });
    expect(next.memoryToPreserve).toBe("優勝したこと");
  });

  it("increments turnCount by 1 regardless of patch content", () => {
    const next = applyStatePatch(base, {});
    expect(next.turnCount).toBe(2);
  });

  it("updates status when patch provides it", () => {
    const next = applyStatePatch(base, { status: "ready_for_decision" });
    expect(next.status).toBe("ready_for_decision");
  });
});
