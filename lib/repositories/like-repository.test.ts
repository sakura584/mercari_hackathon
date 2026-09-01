import { describe, expect, it } from "vitest";
import { createCollection, getCollection } from "./collection-repository";
import { addLike } from "./like-repository";

describe("like-repository", () => {
  it("increments likeCount on the first like", async () => {
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });
    const count = await addLike(collection.id, "liker-1");
    expect(count).toBe(1);
    expect((await getCollection(collection.id))?.likeCount).toBe(1);
  });

  it("does not increment again for the same likerId", async () => {
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });
    await addLike(collection.id, "liker-1");
    const count = await addLike(collection.id, "liker-1");
    expect(count).toBe(1);
  });

  it("increments once per distinct likerId", async () => {
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });
    await addLike(collection.id, "liker-1");
    const count = await addLike(collection.id, "liker-2");
    expect(count).toBe(2);
  });
});
