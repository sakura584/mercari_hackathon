import type Anthropic from "@anthropic-ai/sdk";
import type { ReflectionState } from "./types";

export const MAX_REFLECTION_TURNS = 3;

export const ASK_QUESTION_TOOL: Anthropic.Tool = {
  name: "ask_question",
  description:
    "判断材料としてまだ不足している最も重要な点について、ユーザーに1つだけ質問する",
  input_schema: {
    type: "object",
    properties: {
      reflection: {
        type: "string",
        description: "直前の回答への短い言い換え・仮説的な共感の一文",
      },
      question: { type: "string" },
      statePatch: {
        type: "object",
        properties: {
          attachmentTypes: { type: "array", items: { type: "string" } },
          reasonsToKeep: { type: "array", items: { type: "string" } },
          reasonsToLetGo: { type: "array", items: { type: "string" } },
          memoryToPreserve: { type: "string" },
          regretIfSold: { type: "string" },
          regretIfKept: { type: "string" },
          unresolved: { type: "array", items: { type: "string" } },
        },
      },
    },
    required: ["reflection", "question"],
  },
};

export const COMPLETE_REFLECTION_TOOL: Anthropic.Tool = {
  name: "complete_reflection",
  description: "判断材料が十分に整理できたので対話を終了し、要約を返す",
  input_schema: {
    type: "object",
    properties: {
      reflection: { type: "string" },
      summary: {
        type: "object",
        properties: {
          reasonsToKeep: { type: "array", items: { type: "string" } },
          reasonsToLetGo: { type: "array", items: { type: "string" } },
          memoryToPreserve: { type: "string" },
          regretIfSold: { type: "string" },
          regretIfKept: { type: "string" },
          unresolved: { type: "array", items: { type: "string" } },
        },
      },
    },
    required: ["reflection", "summary"],
  },
};

export function resolveToolChoice(state: ReflectionState): Anthropic.ToolChoice {
  if (state.turnCount >= MAX_REFLECTION_TURNS) {
    return { type: "tool", name: "complete_reflection" };
  }
  return { type: "any" };
}
