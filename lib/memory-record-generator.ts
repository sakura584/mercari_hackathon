import { FunctionCallingConfigMode } from "@google/genai";
import { GEMINI_MODEL, getGeminiClient } from "./gemini";
import { SAVE_MEMORY_RECORD_TOOL } from "./memory-record-tool";
import type { ReflectionState } from "./types";

type MemoryRecordText = { episode?: string; memory: string; reasonForLettingGo?: string; tags: string[] };

export async function generateMemoryRecordText(itemName: string, reflectionState: ReflectionState | null): Promise<MemoryRecordText> {
  const context = reflectionState ? JSON.stringify(reflectionState) : JSON.stringify({ itemName, note: "対話は行われていない" });
  const response = await getGeminiClient().models.generateContent({
    model: GEMINI_MODEL,
    contents: `「${itemName}」を手放すことになりました。思い出アルバム用に短く整理してください。\n${context}`,
    config: {
      tools: [{ functionDeclarations: [SAVE_MEMORY_RECORD_TOOL] }],
      toolConfig: { functionCallingConfig: {
        mode: FunctionCallingConfigMode.ANY,
        allowedFunctionNames: ["save_memory_record"],
      } },
    },
  });
  const input = response.functionCalls?.[0]?.args as MemoryRecordText | undefined;
  return {
    episode: input?.episode,
    memory: input?.memory ?? `${itemName}を手放した。`,
    reasonForLettingGo: input?.reasonForLettingGo,
    tags: input?.tags ?? [],
  };
}
