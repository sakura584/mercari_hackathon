import { NextResponse } from "next/server";
import { GEMINI_MODEL, getGeminiClient } from "@/lib/gemini";
import { EXTRACT_ITEMS_SCHEMA } from "@/lib/extraction-tools";
import { FALLBACK_EXTRACTED_ITEMS } from "@/lib/extraction-fallback";
import { uploadRoomImage } from "@/lib/storage";
import { createItem } from "@/lib/repositories/item-repository";
import type { Item } from "@/lib/types";

type ExtractedCandidate = { title: string; category: string };

async function extractCandidates(imageBase64: string, mimeType: string): Promise<ExtractedCandidate[]> {
  const response = await getGeminiClient().models.generateContent({
    model: GEMINI_MODEL,
    contents: [
      { inlineData: { mimeType, data: imageBase64 } },
      { text: "画像内の品物を漏れなく抽出し、指定されたJSON形式で返してください。" },
    ],
    config: { responseMimeType: "application/json", responseJsonSchema: EXTRACT_ITEMS_SCHEMA },
  });
  const items = (JSON.parse(response.text ?? "{}") as { items?: ExtractedCandidate[] }).items;
  if (!items?.length) throw new Error("Gemini returned no items");
  return items;
}

export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null);
  if (!body?.sessionId || !body?.imageBase64 || !body?.mimeType) {
    return NextResponse.json({ error: "sessionId, imageBase64, mimeType are required" }, { status: 400 });
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
    items.push(await createItem({ sessionId: body.sessionId, imageUrl, title: candidate.title, category: candidate.category }));
  }
  return NextResponse.json({ items }, { status: 201 });
}
