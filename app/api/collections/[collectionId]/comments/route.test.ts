import { describe, expect, it } from "vitest";
import { createCollection } from "@/lib/repositories/collection-repository";
import { POST } from "./route";

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/comments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST comments", () => {
  it("creates a comment", async () => {
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });
    const res = await POST(jsonRequest({ authorName: "あおい", text: "いいですね" }), {
      params: Promise.resolve({ collectionId: collection.id }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.authorName).toBe("あおい");
  });

  it("rejects an empty text", async () => {
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });
    const res = await POST(jsonRequest({ authorName: "あおい", text: "" }), {
      params: Promise.resolve({ collectionId: collection.id }),
    });
    expect(res.status).toBe(400);
  });
});
