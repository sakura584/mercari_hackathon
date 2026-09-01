import { describe, expect, it } from "vitest";
import { createCollection } from "@/lib/repositories/collection-repository";
import { createItem } from "@/lib/repositories/item-repository";
import { createBuyRequest, listPendingBuyRequests } from "@/lib/repositories/buy-request-repository";
import { PATCH } from "./route";

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/buy-requests", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH buy-request status", () => {
  it("marks a buy request as declined", async () => {
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });
    const item = await createItem({
      collectionId: collection.id,
      imageUrl: "https://example.com/lamp.jpg",
      title: "フロアランプ",
      category: "default",
    });
    const buyRequest = await createBuyRequest({
      collectionId: collection.id,
      itemId: item.id,
      itemName: item.title,
      fromName: "たなか",
      price: 3000,
    });

    const res = await PATCH(jsonRequest({ status: "declined" }), {
      params: Promise.resolve({ collectionId: collection.id, itemId: item.id, buyRequestId: buyRequest.id }),
    });

    expect(res.status).toBe(204);
    expect(await listPendingBuyRequests(collection.id)).toEqual([]);
  });

  it("rejects an invalid status", async () => {
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });
    const item = await createItem({
      collectionId: collection.id,
      imageUrl: "https://example.com/lamp.jpg",
      title: "フロアランプ",
      category: "default",
    });
    const buyRequest = await createBuyRequest({
      collectionId: collection.id,
      itemId: item.id,
      itemName: item.title,
      fromName: "たなか",
      price: 3000,
    });

    const res = await PATCH(jsonRequest({ status: "pending" }), {
      params: Promise.resolve({ collectionId: collection.id, itemId: item.id, buyRequestId: buyRequest.id }),
    });

    expect(res.status).toBe(400);
  });
});
