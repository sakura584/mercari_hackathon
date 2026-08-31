import type Anthropic from "@anthropic-ai/sdk";

export const SAVE_MEMORY_RECORD_TOOL: Anthropic.Tool = {
  name: "save_memory_record",
  description:
    "手放すと決めた所有物について、ユーザーが残したい思い出や手放した理由をアルバム用の文章として整える",
  input_schema: {
    type: "object",
    properties: {
      episode: { type: "string", description: "アルバムに表示する短いエピソード文" },
      memory: { type: "string", description: "残しておきたい記憶・意味" },
      reasonForLettingGo: { type: "string" },
      tags: { type: "array", items: { type: "string" } },
    },
    required: ["memory"],
  },
};
