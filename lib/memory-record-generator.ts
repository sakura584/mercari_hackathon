import { CLAUDE_MODEL, getAnthropicClient } from "./anthropic";
import { SAVE_MEMORY_RECORD_TOOL } from "./memory-record-tool";
import type { ReflectionState } from "./types";

type MemoryRecordText = {
  episode?: string;
  memory: string;
  reasonForLettingGo?: string;
  tags: string[];
};

export async function generateMemoryRecordText(
  itemName: string,
  reflectionState: ReflectionState | null
): Promise<MemoryRecordText> {
  const client = getAnthropicClient();
  const context = reflectionState
    ? JSON.stringify(reflectionState)
    : JSON.stringify({ itemName, note: "対話は行われていない" });

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 512,
    tools: [SAVE_MEMORY_RECORD_TOOL],
    tool_choice: { type: "tool", name: "save_memory_record" },
    messages: [
      {
        role: "user",
        content: `ユーザーは「${itemName}」を手放すことに決めました。以下の情報をもとに、手放したものアルバムに残す短いエピソード文と、残しておきたい記憶を整えてください。\n\n${context}`,
      },
    ],
  });

  const toolUse = response.content.find(
    (block): block is Extract<typeof block, { type: "tool_use" }> => block.type === "tool_use"
  );
  const input = toolUse?.input as MemoryRecordText | undefined;

  return {
    episode: input?.episode,
    memory: input?.memory ?? `${itemName}を手放しました。`,
    reasonForLettingGo: input?.reasonForLettingGo,
    tags: input?.tags ?? [],
  };
}
