import { describe, expect, it, vi, beforeEach } from "vitest";
import { createSession } from "@/lib/repositories/session-repository";
import { createItem } from "@/lib/repositories/item-repository";
import { createReflection, getReflectionState } from "@/lib/repositories/reflection-repository";

const messagesCreateMock = vi.fn();

vi.mock("@/lib/anthropic", () => ({
  CLAUDE_MODEL: "claude-sonnet-5",
  getAnthropicClient: () => ({
    messages: { create: messagesCreateMock },
  }),
}));

function jsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/reflection/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function setupItem() {
  const session = await createSession({ purposeType: "declutter" });
  const item = await createItem({
    sessionId: session.id,
    imageUrl: "https://example.com/x.jpg",
    title: "サークルTシャツ",
    category: "clothing_tshirt",
  });
  await createReflection(session.id, item.id, item.title);
  return { session, item };
}

describe("POST reflection messages", () => {
  beforeEach(() => {
    messagesCreateMock.mockReset();
  });

  it("returns the next question and persists the state patch", async () => {
    messagesCreateMock.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          name: "ask_question",
          input: {
            reflection: "大会との結びつきが大きそうですね。",
            question: "一番覚えていることは何ですか？",
            statePatch: { attachmentTypes: ["memory"], reasonsToKeep: ["大会で着た"] },
          },
        },
      ],
    });

    const { session, item } = await setupItem();
    const { POST } = await import("./route");
    const res = await POST(jsonRequest({ message: "最後の大会で着たから迷う" }), {
      params: Promise.resolve({ sessionId: session.id, itemId: item.id }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.action).toBe("ask");
    expect(body.question).toBe("一番覚えていることは何ですか？");

    const state = await getReflectionState(session.id, item.id);
    expect(state?.turnCount).toBe(1);
    expect(state?.reasonsToKeep).toEqual(["大会で着た"]);
  });

  it("returns a summary when Claude calls complete_reflection", async () => {
    messagesCreateMock.mockResolvedValue({
      content: [
        {
          type: "tool_use",
          name: "complete_reflection",
          input: {
            reflection: "十分に整理できました。",
            summary: { reasonsToKeep: ["大会で着た"], reasonsToLetGo: ["今後着ない"] },
          },
        },
      ],
    });

    const { session, item } = await setupItem();
    const { POST } = await import("./route");
    const res = await POST(jsonRequest({ message: "もう着ないかも" }), {
      params: Promise.resolve({ sessionId: session.id, itemId: item.id }),
    });

    const body = await res.json();
    expect(body.action).toBe("complete");
    expect(body.summary.reasonsToLetGo).toEqual(["今後着ない"]);

    const state = await getReflectionState(session.id, item.id);
    expect(state?.status).toBe("ready_for_decision");
  });

  it("forces complete_reflection once the turn limit is reached", async () => {
    const { session, item } = await setupItem();

    // turnCountを上限まで進める
    for (let i = 0; i < 3; i += 1) {
      messagesCreateMock.mockResolvedValueOnce({
        content: [
          {
            type: "tool_use",
            name: "ask_question",
            input: { reflection: "…", question: `質問${i}`, statePatch: {} },
          },
        ],
      });
      const { POST } = await import("./route");
      await POST(jsonRequest({ message: `回答${i}` }), {
        params: Promise.resolve({ sessionId: session.id, itemId: item.id }),
      });
    }

    messagesCreateMock.mockResolvedValueOnce({
      content: [
        {
          type: "tool_use",
          name: "complete_reflection",
          input: { reflection: "十分です。", summary: { reasonsToKeep: [] } },
        },
      ],
    });

    const { POST } = await import("./route");
    await POST(jsonRequest({ message: "最後の回答" }), {
      params: Promise.resolve({ sessionId: session.id, itemId: item.id }),
    });

    const lastCallArgs = messagesCreateMock.mock.calls.at(-1)?.[0];
    expect(lastCallArgs.tool_choice).toEqual({ type: "tool", name: "complete_reflection" });
  });
});
