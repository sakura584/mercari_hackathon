import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCollection } from "@/lib/repositories/collection-repository";
import { createItem } from "@/lib/repositories/item-repository";
import { createReflection, getReflectionState } from "@/lib/repositories/reflection-repository";

const generateContentMock = vi.fn();
vi.mock("@/lib/gemini", () => ({ GEMINI_MODEL: "gemini-test", getGeminiClient: () => ({ models: { generateContent: generateContentMock } }) }));

async function setup() {
  const collection = await createCollection({ ownerName: "A", title: "コレクション" });
  const item = await createItem({ collectionId: collection.id, imageUrl: "https://example.com/a.jpg", title: "Tシャツ", category: "clothing_tshirt" });
  await createReflection(collection.id, item.id, item.title);
  return { collection, item };
}
function request(message: string) {
  return new Request("http://localhost/api/reflection/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }) });
}

describe("POST reflection messages", () => {
  beforeEach(() => generateContentMock.mockReset());

  it("persists Gemini's ask_question function call", async () => {
    generateContentMock.mockResolvedValue({ functionCalls: [{ name: "ask_question", args: { reflection: "気持ちが伝わりました。", question: "何が一番大切ですか？", statePatch: { reasonsToKeep: ["思い出"] } } }] });
    const { collection, item } = await setup();
    const { POST } = await import("./route");
    const res = await POST(request("大切です"), { params: Promise.resolve({ collectionId: collection.id, itemId: item.id }) });
    expect((await res.json()).action).toBe("ask");
    expect((await getReflectionState(collection.id, item.id))?.reasonsToKeep).toEqual(["思い出"]);
  });

  it("forces complete_reflection after the maximum turns", async () => {
    const { collection, item } = await setup();
    const { POST } = await import("./route");
    for (let turn = 0; turn < 3; turn += 1) {
      generateContentMock.mockResolvedValueOnce({ functionCalls: [{ name: "ask_question", args: { reflection: "…", question: "質問", statePatch: {} } }] });
      await POST(request("回答"), { params: Promise.resolve({ collectionId: collection.id, itemId: item.id }) });
    }
    generateContentMock.mockResolvedValueOnce({ functionCalls: [{ name: "complete_reflection", args: { reflection: "整理できました。", summary: {} } }] });
    await POST(request("最後の回答"), { params: Promise.resolve({ collectionId: collection.id, itemId: item.id }) });
    const call = generateContentMock.mock.calls.at(-1)?.[0];
    expect(call.config.toolConfig.functionCallingConfig.allowedFunctionNames).toEqual(["complete_reflection"]);
  });
});
