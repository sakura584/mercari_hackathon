import { describe, expect, it, vi, beforeEach } from "vitest";
import { createSession } from "@/lib/repositories/session-repository";
import { createItem, listItems } from "@/lib/repositories/item-repository";
import { createReflection } from "@/lib/repositories/reflection-repository";
import { listAlbumEntries } from "@/lib/repositories/album-repository";

const messagesCreateMock = vi.fn();

vi.mock("@/lib/anthropic", () => ({
  CLAUDE_MODEL: "claude-sonnet-5",
  getAnthropicClient: () => ({ messages: { create: messagesCreateMock } }),
}));

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/decision", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST decision", () => {
  beforeEach(() => {
    messagesCreateMock.mockReset();
  });

  it("saves finalDecision and creates an album entry when letting go", async () => {
    messagesCreateMock.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          name: "save_memory_record",
          input: { memory: "大会の記憶", tags: ["サークル"] },
        },
      ],
    });

    const session = await createSession({ purposeType: "declutter" });
    const item = await createItem({
      sessionId: session.id,
      imageUrl: "https://example.com/x.jpg",
      title: "サークルTシャツ",
      category: "clothing_tshirt",
    });
    await createReflection(session.id, item.id, item.title);

    const { POST } = await import("./route");
    const res = await POST(
      jsonRequest({ decision: "let_go", itemName: item.title, imageUrl: item.imageUrl }),
      { params: Promise.resolve({ sessionId: session.id, itemId: item.id }) }
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.albumEntry.memory).toBe("大会の記憶");

    const [updated] = await listItems(session.id);
    expect(updated.finalDecision).toBe("let_go");

    const entries = await listAlbumEntries(session.id);
    expect(entries).toHaveLength(1);
  });

  it("saves finalDecision without creating an album entry when keeping", async () => {
    const session = await createSession({ purposeType: "declutter" });
    const item = await createItem({
      sessionId: session.id,
      imageUrl: "https://example.com/x.jpg",
      title: "ヘッドホン",
      category: "electronics_audio",
    });

    const { POST } = await import("./route");
    const res = await POST(
      jsonRequest({ decision: "keep", itemName: item.title, imageUrl: item.imageUrl }),
      { params: Promise.resolve({ sessionId: session.id, itemId: item.id }) }
    );

    expect(res.status).toBe(200);
    const entries = await listAlbumEntries(session.id);
    expect(entries).toHaveLength(0);
    expect(messagesCreateMock).not.toHaveBeenCalled();
  });
});
