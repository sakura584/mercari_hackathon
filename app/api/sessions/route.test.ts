import { describe, expect, it } from "vitest";
import { POST } from "./route";

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/sessions", () => {
  it("creates a session with a valid purposeType", async () => {
    const res = await POST(jsonRequest({ purposeType: "earn_money", targetAmount: 10000 }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBeTruthy();
    expect(body.purposeType).toBe("earn_money");
    expect(body.targetAmount).toBe(10000);
  });

  it("rejects an invalid purposeType", async () => {
    const res = await POST(jsonRequest({ purposeType: "not_a_real_purpose" }));
    expect(res.status).toBe(400);
  });

  it("rejects a missing purposeType", async () => {
    const res = await POST(jsonRequest({}));
    expect(res.status).toBe(400);
  });
});
