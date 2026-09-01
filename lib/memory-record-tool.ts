import type { FunctionDeclaration } from "@google/genai";

export const SAVE_MEMORY_RECORD_TOOL: FunctionDeclaration = {
  name: "save_memory_record",
  description: "手放す品の思い出を、アルバム表示用の短い記録に整理する。",
  parametersJsonSchema: {
    type: "object",
    properties: {
      episode: { type: "string" },
      memory: { type: "string" },
      reasonForLettingGo: { type: "string" },
      tags: { type: "array", items: { type: "string" } },
    },
    required: ["memory"],
  },
};
