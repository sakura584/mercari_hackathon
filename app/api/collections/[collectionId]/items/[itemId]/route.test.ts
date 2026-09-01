import { describe, expect, it } from "vitest";
import { createCollection } from "@/lib/repositories/collection-repository";
import { createItem, listItems } from "@/lib/repositories/item-repository";
import { DELETE, PATCH } from "./route";

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/items", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH item", () => {
  it("updates the item title", async () => {
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });
    const item = await createItem({
      collectionId: collection.id,
      imageUrl: "https://example.com/book.jpg",
      title: "小説",
      category: "book",
    });

    const res = await PATCH(jsonRequest({ title: "小説（改題）" }), {
      params: Promise.resolve({ collectionId: collection.id, itemId: item.id }),
    });

    expect(res.status).toBe(204);
    const [updated] = await listItems(collection.id);
    expect(updated.title).toBe("小説（改題）");
  });

  it("rejects a missing title", async () => {
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });
    const item = await createItem({
      collectionId: collection.id,
      imageUrl: "https://example.com/book.jpg",
      title: "小説",
      category: "book",
    });

    const res = await PATCH(jsonRequest({}), {
      params: Promise.resolve({ collectionId: collection.id, itemId: item.id }),
    });

    expect(res.status).toBe(400);
  });
});

describe("DELETE item", () => {
  it("deletes the item", async () => {
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });
    const item = await createItem({
      collectionId: collection.id,
      imageUrl: "https://example.com/book.jpg",
      title: "小説",
      category: "book",
    });

    const res = await DELETE(new Request("http://localhost/api/items", { method: "DELETE" }), {
      params: Promise.resolve({ collectionId: collection.id, itemId: item.id }),
    });

    expect(res.status).toBe(204);
    expect(await listItems(collection.id)).toEqual([]);
  });
});
