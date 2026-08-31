import { describe, expect, it } from "vitest";
import { buildReflectionUserMessage, REFLECTION_SYSTEM_PROMPT } from "./reflection-prompt";
import type { ReflectionState } from "./types";

describe("REFLECTION_SYSTEM_PROMPT", () => {
  it("instructs the model not to make the final decision", () => {
    expect(REFLECTION_SYSTEM_PROMPT).toContain("結論を出してはいけません");
  });

  it("caps questions to one per turn", () => {
    expect(REFLECTION_SYSTEM_PROMPT).toContain("1ターンにつき質問は1つだけ");
  });
});

describe("buildReflectionUserMessage", () => {
  it("embeds the item name, current state, and latest user message", () => {
    const state: ReflectionState = {
      itemId: "item_001",
      itemName: "サークルTシャツ",
      attachmentTypes: ["memory"],
      reasonsToKeep: ["大会で着た"],
      reasonsToLetGo: [],
      unresolved: [],
      turnCount: 1,
      status: "in_progress",
    };

    const message = buildReflectionUserMessage("サークルTシャツ", state, "写真は残ってる");

    expect(message).toContain("サークルTシャツ");
    expect(message).toContain("大会で着た");
    expect(message).toContain("写真は残ってる");
  });
});
