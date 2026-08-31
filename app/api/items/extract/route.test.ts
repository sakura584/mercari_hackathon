import { describe, expect, it, vi, beforeEach } from "vitest";
import { createSession } from "@/lib/repositories/session-repository";

const messagesCreateMock = vi.fn();

vi.mock("@/lib/anthropic", () => ({
  CLAUDE_MODEL: "claude-sonnet-5",
  getAnthropicClient: () => ({
    messages: { create: messagesCreateMock },
  }),
}));

vi.mock("@/lib/storage", () => ({
  uploadRoomImage: vi.fn().mockResolvedValue("https://storage.googleapis.com/test/room.jpg"),
}));

const ONE_PX_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/items/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/items/extract", () => {
  beforeEach(() => {
    messagesCreateMock.mockReset();
  });

  it("creates items from a successful Claude Vision extraction", async () => {
    messagesCreateMock.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          name: "extract_items",
          input: {
            items: [
              { title: "サークルTシャツ", category: "clothing_tshirt", confidence: 0.8 },
              { title: "小説 3冊セット", category: "book", confidence: 0.7 },
            ],
          },
        },
      ],
    });

    const session = await createSession({ purposeType: "declutter" });
    const { POST } = await import("./route");
    const res = await POST(
      jsonRequest({ sessionId: session.id, imageBase64: ONE_PX_PNG_BASE64, mimeType: "image/png" })
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.items).toHaveLength(2);
    expect(body.items[0].title).toBe("サークルTシャツ");
    expect(body.items[0].estimatedPrice).toBeGreaterThan(0);
  });

  it("falls back to sample items when the Claude API call fails", async () => {
    messagesCreateMock.mockRejectedValue(new Error("network error"));

    const session = await createSession({ purposeType: "declutter" });
    const { POST } = await import("./route");
    const res = await POST(
      jsonRequest({ sessionId: session.id, imageBase64: ONE_PX_PNG_BASE64, mimeType: "image/png" })
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.items.length).toBeGreaterThanOrEqual(3);
  });

  it("rejects a request missing imageBase64", async () => {
    const session = await createSession({ purposeType: "declutter" });
    const { POST } = await import("./route");
    const res = await POST(jsonRequest({ sessionId: session.id, mimeType: "image/png" }));
    expect(res.status).toBe(400);
  });
});
