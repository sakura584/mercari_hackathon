import { describe, expect, it } from "vitest";
import { createCollection } from "@/lib/repositories/collection-repository";
import { POST } from "./route";

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/like", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST like", () => {
  it("increments likeCount and is idempotent for the same likerId", async () => {
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });
    const params = Promise.resolve({ collectionId: collection.id });

    const first = await POST(jsonRequest({ likerId: "liker-1" }), { params });
    expect((await first.json()).likeCount).toBe(1);

    const second = await POST(jsonRequest({ likerId: "liker-1" }), { params });
    expect((await second.json()).likeCount).toBe(1);
  });

  it("rejects a missing likerId", async () => {
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });
    const res = await POST(jsonRequest({}), { params: Promise.resolve({ collectionId: collection.id }) });
    expect(res.status).toBe(400);
  });
});
