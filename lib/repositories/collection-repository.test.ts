import { describe, expect, it } from "vitest";
import { createCollection, getCollection, listCollections, updateCollection } from "./collection-repository";

describe("collection-repository", () => {
  it("creates a collection and reads it back", async () => {
    const collection = await createCollection({ ownerName: "ゆうき", title: "推しグッズコレクション" });

    expect(collection.id).toBeTruthy();
    expect(collection.ownerName).toBe("ゆうき");
    expect(collection.title).toBe("推しグッズコレクション");
    expect(collection.likeCount).toBe(0);

    const fetched = await getCollection(collection.id);
    expect(fetched).toEqual(collection);
  });

  it("returns null for an unknown collection id", async () => {
    const fetched = await getCollection("does-not-exist");
    expect(fetched).toBeNull();
  });

  it("lists collections newest first", async () => {
    const first = await createCollection({ ownerName: "A", title: "コレクション1" });
    const second = await createCollection({ ownerName: "B", title: "コレクション2" });

    const collections = await listCollections();
    const ids = collections.map((c) => c.id);
    expect(ids.indexOf(second.id)).toBeLessThan(ids.indexOf(first.id));
  });

  it("updates title, body, and coverImageUrl", async () => {
    const collection = await createCollection({ ownerName: "A", title: "仮タイトル" });
    await updateCollection(collection.id, {
      title: "在宅ワークの机まわり",
      body: "長時間座っても疲れにくい椅子を探しました。",
      coverImageUrl: "https://example.com/desk.jpg",
    });

    const fetched = await getCollection(collection.id);
    expect(fetched?.title).toBe("在宅ワークの机まわり");
    expect(fetched?.body).toBe("長時間座っても疲れにくい椅子を探しました。");
    expect(fetched?.coverImageUrl).toBe("https://example.com/desk.jpg");
  });
});
