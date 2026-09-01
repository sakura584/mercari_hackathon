import { describe, expect, it } from "vitest";
import { createCollection } from "@/lib/repositories/collection-repository";
import { createItem, listItems } from "@/lib/repositories/item-repository";
import { PATCH } from "./route";

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/collections/x/items/y/classification", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH classification", () => {
  it("updates the item's initialClassification", async () => {
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });
    const item = await createItem({
      collectionId: collection.id,
      imageUrl: "https://example.com/x.jpg",
      title: "本",
      category: "book",
    });

    const res = await PATCH(jsonRequest({ classification: "unsure" }), {
      params: Promise.resolve({ collectionId: collection.id, itemId: item.id }),
    });

    expect(res.status).toBe(204);
    const [updated] = await listItems(collection.id);
    expect(updated.initialClassification).toBe("unsure");
  });

  it("rejects an invalid classification value", async () => {
    const res = await PATCH(jsonRequest({ classification: "nope" }), {
      params: Promise.resolve({ collectionId: "c1", itemId: "i1" }),
    });
    expect(res.status).toBe(400);
  });
});
