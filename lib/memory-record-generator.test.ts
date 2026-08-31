import { describe, expect, it, vi, beforeEach } from "vitest";

const messagesCreateMock = vi.fn();

vi.mock("./anthropic", () => ({
  CLAUDE_MODEL: "claude-sonnet-5",
  getAnthropicClient: () => ({ messages: { create: messagesCreateMock } }),
}));

describe("generateMemoryRecordText", () => {
  beforeEach(() => {
    messagesCreateMock.mockReset();
  });

  it("uses reflection state as context when available", async () => {
    messagesCreateMock.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          name: "save_memory_record",
          input: {
            episode: "最後の大会で着たTシャツ。",
            memory: "2回生最後の大会でチームとして初めて優勝したこと",
            reasonForLettingGo: "今後着る予定はない",
            tags: ["サークル", "卒業"],
          },
        },
      ],
    });

    const { generateMemoryRecordText } = await import("./memory-record-generator");
    const result = await generateMemoryRecordText("サークルTシャツ", {
      itemId: "item_001",
      itemName: "サークルTシャツ",
      attachmentTypes: ["memory"],
      reasonsToKeep: ["最後の大会で着た"],
      reasonsToLetGo: ["今後着ない"],
      memoryToPreserve: "2回生最後の大会でチームとして初めて優勝したこと",
      unresolved: [],
      turnCount: 2,
      status: "ready_for_decision",
    });

    expect(result.memory).toContain("優勝");
    expect(result.tags).toContain("サークル");
  });

  it("falls back to a minimal record when there is no reflection state", async () => {
    messagesCreateMock.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          name: "save_memory_record",
          input: { memory: "特に記録なし", tags: [] },
        },
      ],
    });

    const { generateMemoryRecordText } = await import("./memory-record-generator");
    const result = await generateMemoryRecordText("小説 3冊セット", null);
    expect(result.memory).toBeTruthy();
  });
});
