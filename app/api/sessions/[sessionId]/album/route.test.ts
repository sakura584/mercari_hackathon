import { describe, expect, it } from "vitest";
import { createSession } from "@/lib/repositories/session-repository";
import { createAlbumEntry } from "@/lib/repositories/album-repository";
import { GET } from "./route";

describe("GET album", () => {
  it("returns album entries for the session", async () => {
    const session = await createSession({ purposeType: "declutter" });
    await createAlbumEntry(session.id, {
      itemId: "item_001",
      itemName: "サークルTシャツ",
      imageUrl: "https://example.com/x.jpg",
      memory: "大会の記憶",
      tags: [],
    });

    const res = await GET(new Request("http://localhost/api/album"), {
      params: Promise.resolve({ sessionId: session.id }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0].itemName).toBe("サークルTシャツ");
  });

  it("returns an empty array when there are no entries", async () => {
    const session = await createSession({ purposeType: "declutter" });
    const res = await GET(new Request("http://localhost/api/album"), {
      params: Promise.resolve({ sessionId: session.id }),
    });
    const body = await res.json();
    expect(body.entries).toEqual([]);
  });
});
