import { describe, expect, it } from "vitest";
import { createCollection } from "./collection-repository";
import { createItem } from "./item-repository";
import {
  createBuyRequest,
  listPendingBuyRequests,
  updateBuyRequestStatus,
} from "./buy-request-repository";

describe("buy-request-repository", () => {
  it("creates a pending buy request and lists it", async () => {
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

    expect(buyRequest.status).toBe("pending");

    const pending = await listPendingBuyRequests(collection.id);
    expect(pending).toHaveLength(1);
    expect(pending[0].id).toBe(buyRequest.id);
  });

  it("excludes non-pending buy requests from the list", async () => {
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

    await updateBuyRequestStatus(collection.id, buyRequest.id, "declined");

    expect(await listPendingBuyRequests(collection.id)).toEqual([]);
  });
});
