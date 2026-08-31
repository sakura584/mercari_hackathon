import { describe, expect, it } from "vitest";
import { createSession } from "@/lib/repositories/session-repository";
import { createItem, listItems } from "@/lib/repositories/item-repository";
import { PATCH } from "./route";

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/sessions/x/items/y/classification", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("PATCH classification", () => {
  it("updates the item's initialClassification", async () => {
    const session = await createSession({ purposeType: "declutter" });
    const item = await createItem({
      sessionId: session.id,
      imageUrl: "https://example.com/x.jpg",
      title: "本",
      category: "book",
    });

    const res = await PATCH(jsonRequest({ classification: "unsure" }), {
      params: Promise.resolve({ sessionId: session.id, itemId: item.id }),
    });

    expect(res.status).toBe(204);
    const [updated] = await listItems(session.id);
    expect(updated.initialClassification).toBe("unsure");
  });

  it("rejects an invalid classification value", async () => {
    const res = await PATCH(jsonRequest({ classification: "nope" }), {
      params: Promise.resolve({ sessionId: "s1", itemId: "i1" }),
    });
    expect(res.status).toBe(400);
  });
});
