import { describe, expect, it } from "vitest";
import { createCollection } from "./collection-repository";
import { createItem } from "./item-repository";
import {
  appendReflectionTurn,
  createReflection,
  getReflectionState,
  saveReflectionState,
} from "./reflection-repository";

describe("reflection-repository", () => {
  it("creates an initial reflection state and reads it back", async () => {
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });
    const item = await createItem({
      collectionId: collection.id,
      imageUrl: "https://example.com/shirt.jpg",
      title: "サークルTシャツ",
      category: "clothing_tshirt",
    });

    const created = await createReflection(collection.id, item.id, item.title);
    expect(created.turnCount).toBe(0);
    expect(created.status).toBe("in_progress");

    const fetched = await getReflectionState(collection.id, item.id);
    expect(fetched).toEqual(created);
  });

  it("saves an updated state and returns it on read", async () => {
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });
    const item = await createItem({
      collectionId: collection.id,
      imageUrl: "https://example.com/shirt.jpg",
      title: "サークルTシャツ",
      category: "clothing_tshirt",
    });
    const created = await createReflection(collection.id, item.id, item.title);

    const updated = { ...created, turnCount: 1, reasonsToKeep: ["大会で着た"] };
    await saveReflectionState(collection.id, item.id, updated);

    const fetched = await getReflectionState(collection.id, item.id);
    expect(fetched?.turnCount).toBe(1);
    expect(fetched?.reasonsToKeep).toEqual(["大会で着た"]);
  });

  it("returns null when no reflection exists yet", async () => {
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });
    const fetched = await getReflectionState(collection.id, "no-such-item");
    expect(fetched).toBeNull();
  });

  it("appends a turn log entry without throwing", async () => {
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });
    const item = await createItem({
      collectionId: collection.id,
      imageUrl: "https://example.com/shirt.jpg",
      title: "サークルTシャツ",
      category: "clothing_tshirt",
    });
    await createReflection(collection.id, item.id, item.title);

    await expect(
      appendReflectionTurn(collection.id, item.id, {
        turnIndex: 0,
        userMessage: "最後の大会で着たから迷う",
        assistantAction: "ask",
        assistantReflectionText: "大会との結びつきが大きそうですね。",
        question: "一番覚えていることは何ですか？",
        createdAt: new Date().toISOString(),
      })
    ).resolves.not.toThrow();
  });
});
