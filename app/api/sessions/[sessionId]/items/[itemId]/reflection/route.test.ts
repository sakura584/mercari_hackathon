import { describe, expect, it } from "vitest";
import { createSession } from "@/lib/repositories/session-repository";
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
    const session = await createSession({ purposeType: "declutter" });
    const item = await createItem({
      sessionId: session.id,
      imageUrl: "https://example.com/x.jpg",
      title: "サークルTシャツ",
      category: "clothing_tshirt",
    });

    const res = await POST(jsonRequest({ itemName: item.title }), {
      params: Promise.resolve({ sessionId: session.id, itemId: item.id }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.turnCount).toBe(0);
    expect(body.status).toBe("in_progress");
    expect(body.itemName).toBe("サークルTシャツ");
  });
});
