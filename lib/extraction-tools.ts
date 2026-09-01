export const EXTRACT_ITEMS_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          category: { type: "string" },
          confidence: { type: "number" },
          x: {
            type: "number",
            description: "写真の左上を原点とした対象物の中心のおおよその横位置（0〜100のパーセンテージ）",
          },
          y: {
            type: "number",
            description: "写真の左上を原点とした対象物の中心のおおよその縦位置（0〜100のパーセンテージ）",
          },
        },
        required: ["title", "category"],
      },
    },
  },
  required: ["items"],
};
