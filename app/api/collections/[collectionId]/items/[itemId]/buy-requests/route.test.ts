import { describe, expect, it } from "vitest";
import { createCollection } from "@/lib/repositories/collection-repository";
import { createItem } from "@/lib/repositories/item-repository";
import { POST } from "./route";

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/buy-requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST buy-requests", () => {
  it("creates a pending buy request for the item", async () => {
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });
    const item = await createItem({
      collectionId: collection.id,
      imageUrl: "https://example.com/lamp.jpg",
      title: "フロアランプ",
      category: "default",
    });

    const res = await POST(jsonRequest({ fromName: "たなか", price: 3000 }), {
      params: Promise.resolve({ collectionId: collection.id, itemId: item.id }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.itemName).toBe("フロアランプ");
    expect(body.status).toBe("pending");
  });

  it("returns 404 for an unknown item", async () => {
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });
    const res = await POST(jsonRequest({ fromName: "たなか", price: 3000 }), {
      params: Promise.resolve({ collectionId: collection.id, itemId: "does-not-exist" }),
    });
    expect(res.status).toBe(404);
  });

  it("rejects a missing price", async () => {
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });
    const item = await createItem({
      collectionId: collection.id,
      imageUrl: "https://example.com/lamp.jpg",
      title: "フロアランプ",
      category: "default",
    });
    const res = await POST(jsonRequest({ fromName: "たなか" }), {
      params: Promise.resolve({ collectionId: collection.id, itemId: item.id }),
    });
    expect(res.status).toBe(400);
  });
});
