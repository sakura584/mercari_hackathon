import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCollection } from "@/lib/repositories/collection-repository";
import { createItem, listItems } from "@/lib/repositories/item-repository";
import { listAlbumEntries } from "@/lib/repositories/album-repository";

const generateContentMock = vi.fn();
vi.mock("@/lib/gemini", () => ({ GEMINI_MODEL: "gemini-test", getGeminiClient: () => ({ models: { generateContent: generateContentMock } }) }));

function request(body: unknown) {
  return new Request("http://localhost/api/decision", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

describe("POST decision", () => {
  beforeEach(() => generateContentMock.mockReset());

  it("creates an album entry from Gemini's function call", async () => {
    generateContentMock.mockResolvedValue({ functionCalls: [{ name: "save_memory_record", args: { memory: "大切な思い出", tags: ["Tシャツ"] } }] });
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });
    const item = await createItem({ collectionId: collection.id, imageUrl: "https://example.com/a.jpg", title: "Tシャツ", category: "clothing_tshirt" });
    const { POST } = await import("./route");
    const res = await POST(request({ decision: "let_go", itemName: item.title, imageUrl: item.imageUrl }), { params: Promise.resolve({ collectionId: collection.id, itemId: item.id }) });
    expect(res.status).toBe(201);
    expect((await res.json()).albumEntry.memory).toBe("大切な思い出");
    expect((await listItems(collection.id))[0].finalDecision).toBe("let_go");
    expect(await listAlbumEntries(collection.id)).toHaveLength(1);
  });
});
