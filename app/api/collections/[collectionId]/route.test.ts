import { describe, expect, it } from "vitest";
import { createCollection } from "@/lib/repositories/collection-repository";
import { createItem } from "@/lib/repositories/item-repository";
import { createComment } from "@/lib/repositories/comment-repository";
import { GET, PATCH } from "./route";

describe("GET /api/collections/[collectionId]", () => {
  it("returns the collection with its items and comments", async () => {
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });
    await createItem({
      collectionId: collection.id,
      imageUrl: "https://example.com/x.jpg",
      title: "本",
      category: "book",
    });
    await createComment({ collectionId: collection.id, authorName: "あおい", text: "いいですね" });

    const res = await GET(new Request("http://localhost/api/collections/x"), {
      params: Promise.resolve({ collectionId: collection.id }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.collection.id).toBe(collection.id);
    expect(body.items).toHaveLength(1);
    expect(body.comments).toHaveLength(1);
    expect(body.comments[0].authorName).toBe("あおい");
  });

  it("returns 404 for an unknown collection", async () => {
    const res = await GET(new Request("http://localhost/api/collections/x"), {
      params: Promise.resolve({ collectionId: "does-not-exist" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/collections/[collectionId]", () => {
  it("updates title and body", async () => {
    const collection = await createCollection({ ownerName: "A", title: "仮タイトル" });

    const res = await PATCH(
      new Request("http://localhost/api/collections/x", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "本当のタイトル", body: "説明文" }),
      }),
      { params: Promise.resolve({ collectionId: collection.id }) }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe("本当のタイトル");
    expect(body.body).toBe("説明文");
  });
});
