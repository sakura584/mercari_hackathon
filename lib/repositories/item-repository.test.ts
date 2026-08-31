import { describe, expect, it } from "vitest";
import { createSession } from "./session-repository";
import {
  createItem,
  listItems,
  updateItemClassification,
  updateItemDecision,
} from "./item-repository";

describe("item-repository", () => {
  it("creates an item with an estimated price and lists it", async () => {
    const session = await createSession({ purposeType: "declutter" });
    const item = await createItem({
      sessionId: session.id,
      imageUrl: "https://example.com/shirt.jpg",
      title: "サークルTシャツ",
      category: "clothing_tshirt",
    });

    expect(item.id).toBeTruthy();
    expect(item.sessionId).toBe(session.id);
    expect(item.estimatedPrice).toBeGreaterThan(0);

    const items = await listItems(session.id);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe(item.id);
  });

  it("updates classification and final decision", async () => {
    const session = await createSession({ purposeType: "declutter" });
    const item = await createItem({
      sessionId: session.id,
      imageUrl: "https://example.com/book.jpg",
      title: "小説",
      category: "book",
    });

    await updateItemClassification(session.id, item.id, "unsure");
    await updateItemDecision(session.id, item.id, "let_go");

    const [updated] = await listItems(session.id);
    expect(updated.initialClassification).toBe("unsure");
    expect(updated.finalDecision).toBe("let_go");
  });
});
