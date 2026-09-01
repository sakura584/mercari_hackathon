import { describe, expect, it } from "vitest";
import { createCollection } from "./collection-repository";
import { createComment, listComments } from "./comment-repository";

describe("comment-repository", () => {
  it("creates a comment and lists it back", async () => {
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });

    await createComment({ collectionId: collection.id, authorName: "あおい", text: "ランプどこのですか？" });

    const comments = await listComments(collection.id);
    expect(comments).toHaveLength(1);
    expect(comments[0].authorName).toBe("あおい");
    expect(comments[0].text).toBe("ランプどこのですか？");
  });

  it("returns an empty array when there are no comments", async () => {
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });
    expect(await listComments(collection.id)).toEqual([]);
  });
});
