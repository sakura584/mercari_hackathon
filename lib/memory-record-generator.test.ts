import { beforeEach, describe, expect, it, vi } from "vitest";

const generateContentMock = vi.fn();
vi.mock("./gemini", () => ({ GEMINI_MODEL: "gemini-test", getGeminiClient: () => ({ models: { generateContent: generateContentMock } }) }));

describe("generateMemoryRecordText", () => {
  beforeEach(() => generateContentMock.mockReset());

  it("reads the save_memory_record function call", async () => {
    generateContentMock.mockResolvedValue({ functionCalls: [{ name: "save_memory_record", args: { memory: "大切な思い出", tags: ["旅行"] } }] });
    const { generateMemoryRecordText } = await import("./memory-record-generator");
    const result = await generateMemoryRecordText("Tシャツ", null);
    expect(result.memory).toBe("大切な思い出");
    expect(result.tags).toEqual(["旅行"]);
  });
});
