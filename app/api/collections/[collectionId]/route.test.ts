import { describe, expect, it } from "vitest";
import { createCollection } from "@/lib/repositories/collection-repository";
import { createItem } from "@/lib/repositories/item-repository";
import { GET } from "./route";

describe("GET /api/collections/[collectionId]", () => {
  it("returns the collection with its items", async () => {
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });
    await createItem({
      collectionId: collection.id,
      imageUrl: "https://example.com/x.jpg",
      title: "本",
      category: "book",
    });

    const res = await GET(new Request("http://localhost/api/collections/x"), {
      params: Promise.resolve({ collectionId: collection.id }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.collection.id).toBe(collection.id);
    expect(body.items).toHaveLength(1);
  });

  it("returns 404 for an unknown collection", async () => {
    const res = await GET(new Request("http://localhost/api/collections/x"), {
      params: Promise.resolve({ collectionId: "does-not-exist" }),
    });
    expect(res.status).toBe(404);
  });
});
