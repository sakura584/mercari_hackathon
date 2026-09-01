import type { FunctionDeclaration } from "@google/genai";

export const SUGGEST_RELEASE_CANDIDATES_TOOL: FunctionDeclaration = {
  name: "suggest_release_candidates",
  description:
    "コレクションの中から、手放しても収集家としての自分らしさが損なわれなさそうな品を選び、理由を添えて提案する",
  parametersJsonSchema: {
    type: "object",
    properties: {
      candidates: {
        type: "array",
        items: {
          type: "object",
          properties: {
            itemId: { type: "string" },
            reason: {
              type: "string",
              description:
                "このコレクションの中でのこの品の位置づけ（核か周辺か）を踏まえた、手放してもよさそうな理由。次の持ち主に引き継がれるという前向きな含意を含める",
            },
          },
          required: ["itemId", "reason"],
        },
      },
    },
    required: ["candidates"],
  },
};
