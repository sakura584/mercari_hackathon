import { describe, expect, it } from "vitest";
import { createCollection } from "./collection-repository";
import {
  createItem,
  deleteItem,
  listItems,
  updateItemClassification,
  updateItemDecision,
  updateItemTitle,
} from "./item-repository";

describe("item-repository", () => {
  it("creates an item with an estimated price and lists it", async () => {
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });
    const item = await createItem({
      collectionId: collection.id,
      imageUrl: "https://example.com/shirt.jpg",
      title: "サークルTシャツ",
      category: "clothing_tshirt",
    });

    expect(item.id).toBeTruthy();
    expect(item.collectionId).toBe(collection.id);
    expect(item.estimatedPrice).toBeGreaterThan(0);

    const items = await listItems(collection.id);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe(item.id);
  });

  it("updates classification and final decision", async () => {
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });
    const item = await createItem({
      collectionId: collection.id,
      imageUrl: "https://example.com/book.jpg",
      title: "小説",
      category: "book",
    });

    await updateItemClassification(collection.id, item.id, "unsure");
    await updateItemDecision(collection.id, item.id, "let_go");

    const [updated] = await listItems(collection.id);
    expect(updated.initialClassification).toBe("unsure");
    expect(updated.finalDecision).toBe("let_go");
  });

  it("stores pin coordinates when provided", async () => {
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });
    const item = await createItem({
      collectionId: collection.id,
      imageUrl: "https://example.com/lamp.jpg",
      title: "フロアランプ",
      category: "default",
      x: 30,
      y: 42,
    });

    expect(item.x).toBe(30);
    expect(item.y).toBe(42);
  });

  it("updates the title", async () => {
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });
    const item = await createItem({
      collectionId: collection.id,
      imageUrl: "https://example.com/book.jpg",
      title: "小説",
      category: "book",
    });

    await updateItemTitle(collection.id, item.id, "小説（改題）");

    const [updated] = await listItems(collection.id);
    expect(updated.title).toBe("小説（改題）");
  });

  it("deletes an item", async () => {
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });
    const item = await createItem({
      collectionId: collection.id,
      imageUrl: "https://example.com/book.jpg",
      title: "小説",
      category: "book",
    });

    await deleteItem(collection.id, item.id);

    expect(await listItems(collection.id)).toEqual([]);
  });
});
