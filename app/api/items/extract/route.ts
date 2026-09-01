import { NextResponse } from "next/server";
import { GEMINI_MODEL, getGeminiClient } from "@/lib/gemini";
import { EXTRACT_ITEMS_SCHEMA } from "@/lib/extraction-tools";
import { FALLBACK_EXTRACTED_ITEMS } from "@/lib/extraction-fallback";
import { uploadRoomImage } from "@/lib/storage";
import { createItem } from "@/lib/repositories/item-repository";
import type { Item } from "@/lib/types";

type ExtractedCandidate = {
  title: string;
  category: string;
  confidence?: number;
  x?: number;
  y?: number;
};
type ExtractMode = "single" | "collection";

async function extractCandidates(
  imageBase64: string,
  mimeType: string,
  mode: ExtractMode
): Promise<ExtractedCandidate[]> {
  const promptText =
    mode === "single"
      ? "この写真には品物が1点だけ写っています。それを抽出し、指定されたJSON形式で返してください。"
      : "画像内の品物を漏れなく抽出し、指定されたJSON形式で返してください。";

  const response = await getGeminiClient().models.generateContent({
    model: GEMINI_MODEL,
    contents: [
      { inlineData: { mimeType, data: imageBase64 } },
      { text: promptText },
    ],
    config: { responseMimeType: "application/json", responseJsonSchema: EXTRACT_ITEMS_SCHEMA },
  });
  const items = (JSON.parse(response.text ?? "{}") as { items?: ExtractedCandidate[] }).items;
  if (!items?.length) throw new Error("Gemini returned no items");

  if (mode === "single" && items.length > 1) {
    return [[...items].sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0]];
  }
  return items;
}

export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null);
  if (!body?.collectionId || !body?.imageBase64 || !body?.mimeType) {
    return NextResponse.json(
      { error: "collectionId, imageBase64, mimeType are required" },
      { status: 400 }
    );
  }
  const mode: ExtractMode = body.mode === "single" ? "single" : "collection";

  const imageUrl = await uploadRoomImage(body.collectionId, body.imageBase64, body.mimeType);

  let candidates: ExtractedCandidate[];
  try {
    candidates = await extractCandidates(body.imageBase64, body.mimeType, mode);
  } catch {
    candidates = mode === "single" ? [FALLBACK_EXTRACTED_ITEMS[0]] : FALLBACK_EXTRACTED_ITEMS;
  }

  const items: Item[] = [];
  for (const candidate of candidates) {
    items.push(
      await createItem({
        collectionId: body.collectionId,
        imageUrl,
        title: candidate.title,
        category: candidate.category,
        x: candidate.x,
        y: candidate.y,
      })
    );
  }

  return NextResponse.json({ items }, { status: 201 });
}
