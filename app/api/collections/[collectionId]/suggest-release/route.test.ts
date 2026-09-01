import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCollection } from "@/lib/repositories/collection-repository";
import {
  createItem,
  updateItemClassification,
  updateItemDecision,
} from "@/lib/repositories/item-repository";

const generateContentMock = vi.fn();
vi.mock("@/lib/gemini", () => ({
  GEMINI_MODEL: "gemini-test",
  getGeminiClient: () => ({ models: { generateContent: generateContentMock } }),
}));

function request(): Request {
  return new Request("http://localhost/api/suggest-release", { method: "POST" });
}

describe("POST suggest-release", () => {
  beforeEach(() => generateContentMock.mockReset());

  it("returns candidates from Gemini for undecided, non-keep items", async () => {
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });
    const eligible = await createItem({
      collectionId: collection.id,
      imageUrl: "https://example.com/a.jpg",
      title: "限定フィギュアB",
      category: "figure",
    });
    await createItem({
      collectionId: collection.id,
      imageUrl: "https://example.com/b.jpg",
      title: "一番好きなフィギュア",
      category: "figure",
    });
    const kept = await createItem({
      collectionId: collection.id,
      imageUrl: "https://example.com/c.jpg",
      title: "殿堂入りフィギュア",
      category: "figure",
    });
    await updateItemClassification(collection.id, kept.id, "keep");

    generateContentMock.mockResolvedValue({
      functionCalls: [
        {
          name: "suggest_release_candidates",
          args: { candidates: [{ itemId: eligible.id, reason: "重複気味の一品なので次の人に引き継げそう" }] },
        },
      ],
    });

    const { POST } = await import("./route");
    const res = await POST(request(), { params: Promise.resolve({ collectionId: collection.id }) });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.candidates).toHaveLength(1);
    expect(body.candidates[0].itemId).toBe(eligible.id);
  });

  it("returns an empty array without calling Gemini when there are no eligible items", async () => {
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });
    const item = await createItem({
      collectionId: collection.id,
      imageUrl: "https://example.com/a.jpg",
      title: "手放し済みフィギュア",
      category: "figure",
    });
    await updateItemDecision(collection.id, item.id, "let_go");

    const { POST } = await import("./route");
    const res = await POST(request(), { params: Promise.resolve({ collectionId: collection.id }) });

    expect((await res.json()).candidates).toEqual([]);
    expect(generateContentMock).not.toHaveBeenCalled();
  });

  it("filters out itemIds that Gemini hallucinated", async () => {
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });
    await createItem({
      collectionId: collection.id,
      imageUrl: "https://example.com/a.jpg",
      title: "フィギュア",
      category: "figure",
    });

    generateContentMock.mockResolvedValue({
      functionCalls: [
        {
          name: "suggest_release_candidates",
          args: { candidates: [{ itemId: "does-not-exist", reason: "存在しないID" }] },
        },
      ],
    });

    const { POST } = await import("./route");
    const res = await POST(request(), { params: Promise.resolve({ collectionId: collection.id }) });
    expect((await res.json()).candidates).toEqual([]);
  });
});
