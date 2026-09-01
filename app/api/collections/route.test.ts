import { describe, expect, it } from "vitest";
import { POST, GET } from "./route";

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/collections", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/collections", () => {
  it("creates a collection", async () => {
    const res = await POST(jsonRequest({ ownerName: "ゆうき", title: "推しグッズ" }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeTruthy();
    expect(body.ownerName).toBe("ゆうき");
    expect(body.title).toBe("推しグッズ");
  });

  it("rejects a missing title", async () => {
    const res = await POST(jsonRequest({ ownerName: "ゆうき" }));
    expect(res.status).toBe(400);
  });

  it("rejects an empty ownerName", async () => {
    const res = await POST(jsonRequest({ ownerName: "", title: "推しグッズ" }));
    expect(res.status).toBe(400);
  });
});

describe("GET /api/collections", () => {
  it("returns created collections", async () => {
    await POST(jsonRequest({ ownerName: "ゆうき", title: "推しグッズ" }));
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.collections.length).toBeGreaterThanOrEqual(1);
  });
});
