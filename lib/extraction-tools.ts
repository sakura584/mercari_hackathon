import type Anthropic from "@anthropic-ai/sdk";

export const EXTRACT_ITEMS_TOOL: Anthropic.Tool = {
  name: "extract_items",
  description:
    "部屋や棚の写真に写っている、出品候補になりうる私物を1つずつ抽出する",
  input_schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string", description: "仮の商品名（日本語）" },
            category: {
              type: "string",
              description:
                "clothing_tshirt, clothing_outerwear, shoes, book, figure, electronics_audio, bag, accessory, toy, stationery のいずれか。当てはまらない場合はdefault",
            },
            confidence: { type: "number" },
          },
          required: ["title", "category"],
        },
      },
    },
    required: ["items"],
  },
};
