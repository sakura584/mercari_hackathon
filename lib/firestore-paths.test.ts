import { describe, expect, it } from "vitest";
import {
  collectionPath,
  itemsCollectionPath,
  itemPath,
  reflectionPath,
  reflectionTurnsCollectionPath,
  albumCollectionPath,
  albumEntryPath,
  likesCollectionPath,
  likePath,
  buyRequestsCollectionPath,
  buyRequestPath,
  commentsCollectionPath,
  commentPath,
} from "./firestore-paths";

describe("firestore-paths", () => {
  it("builds collection path", () => {
    expect(collectionPath("c1")).toBe("collections/c1");
  });

  it("builds items collection and item path", () => {
    expect(itemsCollectionPath("c1")).toBe("collections/c1/items");
    expect(itemPath("c1", "i1")).toBe("collections/c1/items/i1");
  });

  it("builds reflection document and turns collection path", () => {
    expect(reflectionPath("c1", "i1")).toBe("collections/c1/items/i1/reflection/state");
    expect(reflectionTurnsCollectionPath("c1", "i1")).toBe(
      "collections/c1/items/i1/reflection/state/turns"
    );
  });

  it("builds album collection and entry path", () => {
    expect(albumCollectionPath("c1")).toBe("collections/c1/album");
    expect(albumEntryPath("c1", "m1")).toBe("collections/c1/album/m1");
  });

  it("builds likes collection and like path", () => {
    expect(likesCollectionPath("c1")).toBe("collections/c1/likes");
    expect(likePath("c1", "liker1")).toBe("collections/c1/likes/liker1");
  });

  it("builds buy-requests collection and entry path", () => {
    expect(buyRequestsCollectionPath("c1")).toBe("collections/c1/buy-requests");
    expect(buyRequestPath("c1", "b1")).toBe("collections/c1/buy-requests/b1");
  });

  it("builds comments collection and entry path", () => {
    expect(commentsCollectionPath("c1")).toBe("collections/c1/comments");
    expect(commentPath("c1", "cm1")).toBe("collections/c1/comments/cm1");
  });
});
