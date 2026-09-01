import { describe, expect, it } from "vitest";
import { createCollection } from "@/lib/repositories/collection-repository";
import { createBuyRequest } from "@/lib/repositories/buy-request-repository";
import { GET } from "./route";

describe("GET buy-requests", () => {
  it("returns pending buy requests for the collection", async () => {
    const collection = await createCollection({ ownerName: "A", title: "コレクション" });
    await createBuyRequest({
      collectionId: collection.id,
      itemId: "item_001",
      itemName: "フロアランプ",
      fromName: "たなか",
      price: 3000,
    });

    const res = await GET(new Request("http://localhost/api/buy-requests"), {
      params: Promise.resolve({ collectionId: collection.id }),
    });

    expect(res.status).toBe(200);
    expect((await res.json()).buyRequests).toHaveLength(1);
  });
});
