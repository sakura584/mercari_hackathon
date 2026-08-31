import { describe, expect, it } from "vitest";
import { createSession } from "./session-repository";
import { createItem } from "./item-repository";
import {
  appendReflectionTurn,
  createReflection,
  getReflectionState,
  saveReflectionState,
} from "./reflection-repository";

describe("reflection-repository", () => {
  it("creates an initial reflection state and reads it back", async () => {
    const session = await createSession({ purposeType: "declutter" });
    const item = await createItem({
      sessionId: session.id,
      imageUrl: "https://example.com/shirt.jpg",
      title: "サークルTシャツ",
      category: "clothing_tshirt",
    });

    const created = await createReflection(session.id, item.id, item.title);
    expect(created.turnCount).toBe(0);
    expect(created.status).toBe("in_progress");

    const fetched = await getReflectionState(session.id, item.id);
    expect(fetched).toEqual(created);
  });

  it("saves an updated state and returns it on read", async () => {
    const session = await createSession({ purposeType: "declutter" });
    const item = await createItem({
      sessionId: session.id,
      imageUrl: "https://example.com/shirt.jpg",
      title: "サークルTシャツ",
      category: "clothing_tshirt",
    });
    const created = await createReflection(session.id, item.id, item.title);

    const updated = { ...created, turnCount: 1, reasonsToKeep: ["大会で着た"] };
    await saveReflectionState(session.id, item.id, updated);

    const fetched = await getReflectionState(session.id, item.id);
    expect(fetched?.turnCount).toBe(1);
    expect(fetched?.reasonsToKeep).toEqual(["大会で着た"]);
  });

  it("returns null when no reflection exists yet", async () => {
    const session = await createSession({ purposeType: "declutter" });
    const fetched = await getReflectionState(session.id, "no-such-item");
    expect(fetched).toBeNull();
  });

  it("appends a turn log entry without throwing", async () => {
    const session = await createSession({ purposeType: "declutter" });
    const item = await createItem({
      sessionId: session.id,
      imageUrl: "https://example.com/shirt.jpg",
      title: "サークルTシャツ",
      category: "clothing_tshirt",
    });
    await createReflection(session.id, item.id, item.title);

    await expect(
      appendReflectionTurn(session.id, item.id, {
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
