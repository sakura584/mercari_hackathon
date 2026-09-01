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
        },
        required: ["title", "category"],
      },
    },
  },
  required: ["items"],
};
