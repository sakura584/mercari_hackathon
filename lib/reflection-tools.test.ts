import { describe, expect, it } from "vitest";
import { MAX_REFLECTION_TURNS, resolveToolChoice } from "./reflection-tools";
import type { ReflectionState } from "./types";

function stateWithTurnCount(turnCount: number): ReflectionState {
  return {
    itemId: "item_001",
    itemName: "サークルTシャツ",
    attachmentTypes: [],
    reasonsToKeep: [],
    reasonsToLetGo: [],
    unresolved: [],
    turnCount,
    status: "in_progress",
  };
}

describe("resolveToolChoice", () => {
  it("allows either tool before the turn limit", () => {
    const choice = resolveToolChoice(stateWithTurnCount(MAX_REFLECTION_TURNS - 1));
    expect(choice).toEqual({ type: "any" });
  });

  it("forces complete_reflection once the turn limit is reached", () => {
    const choice = resolveToolChoice(stateWithTurnCount(MAX_REFLECTION_TURNS));
    expect(choice).toEqual({ type: "tool", name: "complete_reflection" });
  });

  it("forces complete_reflection beyond the turn limit", () => {
    const choice = resolveToolChoice(stateWithTurnCount(MAX_REFLECTION_TURNS + 5));
    expect(choice).toEqual({ type: "tool", name: "complete_reflection" });
  });
});
