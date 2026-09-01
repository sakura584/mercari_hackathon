import { describe, expect, it } from "vitest";
import { createCollection } from "./collection-repository";
import { createAlbumEntry, listAlbumEntries } from "./album-repository";

describe("album-repository", () => {
  it("creates an album entry and lists it back", async () => {
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });

    const entry = await createAlbumEntry(collection.id, {
      itemId: "item_001",
      itemName: "サークルTシャツ",
      imageUrl: "https://example.com/shirt.jpg",
      memory: "2回生最後の大会でチームとして初めて優勝したこと",
      episode: "最後の大会で着たTシャツ。",
      reasonForLettingGo: "今後着る予定はない",
      tags: ["サークル", "卒業"],
    });

    expect(entry.id).toBeTruthy();
    expect(entry.createdAt).toBeTruthy();

    const entries = await listAlbumEntries(collection.id);
    expect(entries).toHaveLength(1);
    expect(entries[0].itemName).toBe("サークルTシャツ");
  });

  it("returns an empty array when there are no entries", async () => {
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });
    const entries = await listAlbumEntries(collection.id);
    expect(entries).toEqual([]);
  });
});
