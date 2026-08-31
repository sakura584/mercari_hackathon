import { describe, expect, it } from "vitest";
import {
  sessionPath,
  itemsCollectionPath,
  itemPath,
  reflectionPath,
  reflectionTurnsCollectionPath,
  albumCollectionPath,
  albumEntryPath,
} from "./firestore-paths";

describe("firestore-paths", () => {
  it("builds session path", () => {
    expect(sessionPath("s1")).toBe("sessions/s1");
  });

  it("builds items collection and item path", () => {
    expect(itemsCollectionPath("s1")).toBe("sessions/s1/items");
    expect(itemPath("s1", "i1")).toBe("sessions/s1/items/i1");
  });

  it("builds reflection document and turns collection path", () => {
    expect(reflectionPath("s1", "i1")).toBe(
      "sessions/s1/items/i1/reflection/state"
    );
    expect(reflectionTurnsCollectionPath("s1", "i1")).toBe(
      "sessions/s1/items/i1/reflection/state/turns"
    );
  });

  it("builds album collection and entry path", () => {
    expect(albumCollectionPath("s1")).toBe("sessions/s1/album");
    expect(albumEntryPath("s1", "m1")).toBe("sessions/s1/album/m1");
  });
});
