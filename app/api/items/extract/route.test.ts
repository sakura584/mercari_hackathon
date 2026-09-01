import { beforeEach, describe, expect, it, vi } from "vitest";
import { createSession } from "@/lib/repositories/session-repository";

const generateContentMock = vi.fn();
vi.mock("@/lib/gemini", () => ({ GEMINI_MODEL: "gemini-test", getGeminiClient: () => ({ models: { generateContent: generateContentMock } }) }));
vi.mock("@/lib/storage", () => ({ uploadRoomImage: vi.fn().mockResolvedValue("https://storage.googleapis.com/test/room.jpg") }));

function request(body: unknown) {
  return new Request("http://localhost/api/items/extract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

describe("POST /api/items/extract", () => {
  beforeEach(() => generateContentMock.mockReset());

  it("creates items from Gemini structured output", async () => {
    generateContentMock.mockResolvedValue({ text: JSON.stringify({ items: [{ title: "Tシャツ", category: "clothing_tshirt" }, { title: "本", category: "book" }] }) });
    const session = await createSession({ purposeType: "declutter" });
    const { POST } = await import("./route");
    const res = await POST(request({ sessionId: session.id, imageBase64: "abc", mimeType: "image/png" }));
    expect(res.status).toBe(201);
    expect((await res.json()).items).toHaveLength(2);
  });

  it("falls back when Gemini fails", async () => {
    generateContentMock.mockResolvedValue({ text: "{}" });
    const session = await createSession({ purposeType: "declutter" });
    const { POST } = await import("./route");
    const res = await POST(request({ sessionId: session.id, imageBase64: "abc", mimeType: "image/png" }));
    expect((await res.json()).items.length).toBeGreaterThanOrEqual(3);
  });
});
