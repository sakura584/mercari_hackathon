import type { FunctionDeclaration } from "@google/genai";
import type { ReflectionState } from "./types";

export const MAX_REFLECTION_TURNS = 3;

export const ASK_QUESTION_TOOL: FunctionDeclaration = {
  name: "ask_question",
  description: "共感を示した上で、手放すか考えるための質問を一つだけ返す。",
  parametersJsonSchema: {
    type: "object",
    properties: {
      reflection: { type: "string" },
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

export const COMPLETE_REFLECTION_TOOL: FunctionDeclaration = {
  name: "complete_reflection",
  description: "対話を終え、最終判断のための要約を返す。",
  parametersJsonSchema: {
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

export function resolveToolChoice(state: ReflectionState): string[] {
  return state.turnCount >= MAX_REFLECTION_TURNS
    ? ["complete_reflection"]
    : ["ask_question", "complete_reflection"];
}
