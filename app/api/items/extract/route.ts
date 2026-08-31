import { NextResponse } from "next/server";
import { CLAUDE_MODEL, getAnthropicClient } from "@/lib/anthropic";
import { EXTRACT_ITEMS_TOOL } from "@/lib/extraction-tools";
import { FALLBACK_EXTRACTED_ITEMS } from "@/lib/extraction-fallback";
import { uploadRoomImage } from "@/lib/storage";
import { createItem } from "@/lib/repositories/item-repository";
import type { Item } from "@/lib/types";

type ExtractedCandidate = { title: string; category: string };

async function extractCandidates(
  imageBase64: string,
  mimeType: string
): Promise<ExtractedCandidate[]> {
  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    tools: [EXTRACT_ITEMS_TOOL],
    tool_choice: { type: "tool", name: "extract_items" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mimeType as "image/png", data: imageBase64 },
          },
          {
            type: "text",
            text: "この部屋・棚の写真から、出品候補になりうる私物を抽出してください。",
          },
        ],
      },
    ],
  });

  const toolUse = response.content.find(
    (block): block is Extract<typeof block, { type: "tool_use" }> => block.type === "tool_use"
  );
  const items = (toolUse?.input as { items?: ExtractedCandidate[] } | undefined)?.items;
  if (!items || items.length === 0) {
    throw new Error("Claude returned no items");
  }
  return items;
}

export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null);

  if (!body?.sessionId || !body?.imageBase64 || !body?.mimeType) {
    return NextResponse.json(
      { error: "sessionId, imageBase64, mimeType are required" },
      { status: 400 }
    );
  }

  const imageUrl = await uploadRoomImage(body.sessionId, body.imageBase64, body.mimeType);

  let candidates: ExtractedCandidate[];
  try {
    candidates = await extractCandidates(body.imageBase64, body.mimeType);
  } catch {
    candidates = FALLBACK_EXTRACTED_ITEMS;
  }

  const items: Item[] = [];
  for (const candidate of candidates) {
    const item = await createItem({
      sessionId: body.sessionId,
      imageUrl,
      title: candidate.title,
      category: candidate.category,
    });
    items.push(item);
  }

  return NextResponse.json({ items }, { status: 201 });
}
