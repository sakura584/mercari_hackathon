import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCollection } from "@/lib/repositories/collection-repository";

const generateContentMock = vi.fn();
vi.mock("@/lib/gemini", () => ({ GEMINI_MODEL: "gemini-test", getGeminiClient: () => ({ models: { generateContent: generateContentMock } }) }));
vi.mock("@/lib/storage", () => ({ uploadRoomImage: vi.fn().mockResolvedValue("https://storage.googleapis.com/test/room.jpg") }));

function request(body: unknown) {
  return new Request("http://localhost/api/items/extract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

describe("POST /api/items/extract", () => {
  beforeEach(() => generateContentMock.mockReset());

  it("creates items from Gemini structured output (collection mode, default)", async () => {
    generateContentMock.mockResolvedValue({ text: JSON.stringify({ items: [{ title: "Tシャツ", category: "clothing_tshirt" }, { title: "本", category: "book" }] }) });
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });
    const { POST } = await import("./route");
    const res = await POST(request({ collectionId: collection.id, imageBase64: "abc", mimeType: "image/png" }));
    expect(res.status).toBe(201);
    expect((await res.json()).items).toHaveLength(2);
  });

  it("passes through pin coordinates when Gemini returns them", async () => {
    generateContentMock.mockResolvedValue({
      text: JSON.stringify({ items: [{ title: "フィギュア", category: "figure", x: 30, y: 62 }] }),
    });
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });
    const { POST } = await import("./route");
    const res = await POST(request({ collectionId: collection.id, imageBase64: "abc", mimeType: "image/png" }));
    const body = await res.json();
    expect(body.items[0].x).toBe(30);
    expect(body.items[0].y).toBe(62);
  });

  it("keeps only the highest-confidence item in single mode when Gemini returns more than one", async () => {
    generateContentMock.mockResolvedValue({
      text: JSON.stringify({
        items: [
          { title: "背景の棚", category: "default", confidence: 0.2 },
          { title: "フィギュア", category: "figure", confidence: 0.9 },
        ],
      }),
    });
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });
    const { POST } = await import("./route");
    const res = await POST(request({ collectionId: collection.id, imageBase64: "abc", mimeType: "image/png", mode: "single" }));
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].title).toBe("フィギュア");
  });

  it("returns the Gemini error instead of fallback items", async () => {
    generateContentMock.mockResolvedValue({ text: "{}" });
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });
    const { POST } = await import("./route");
    const res = await POST(request({ collectionId: collection.id, imageBase64: "abc", mimeType: "image/png" }));
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("Gemini extraction failed");
  });

  it("returns the Gemini error in single mode too", async () => {
    generateContentMock.mockResolvedValue({ text: "{}" });
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });
    const { POST } = await import("./route");
    const res = await POST(request({ collectionId: collection.id, imageBase64: "abc", mimeType: "image/png", mode: "single" }));
    expect(res.status).toBe(502);
  });
});
