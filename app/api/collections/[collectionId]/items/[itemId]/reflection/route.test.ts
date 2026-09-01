import { describe, expect, it } from "vitest";
import { createCollection } from "@/lib/repositories/collection-repository";
import { createItem } from "@/lib/repositories/item-repository";
import { POST } from "./route";

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/reflection", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST reflection init", () => {
  it("creates an initial ReflectionState", async () => {
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });
    const item = await createItem({
      collectionId: collection.id,
      imageUrl: "https://example.com/x.jpg",
      title: "サークルTシャツ",
      category: "clothing_tshirt",
    });

    const res = await POST(jsonRequest({ itemName: item.title }), {
      params: Promise.resolve({ collectionId: collection.id, itemId: item.id }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.turnCount).toBe(0);
    expect(body.status).toBe("in_progress");
    expect(body.itemName).toBe("サークルTシャツ");
  });
});
