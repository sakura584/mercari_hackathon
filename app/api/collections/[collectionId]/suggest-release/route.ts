import { NextResponse } from "next/server";
import { FunctionCallingConfigMode } from "@google/genai";
import { GEMINI_MODEL, getGeminiClient } from "@/lib/gemini";
import { SUGGEST_RELEASE_CANDIDATES_TOOL } from "@/lib/release-suggestion-tool";
import { RELEASE_SUGGESTION_SYSTEM_PROMPT } from "@/lib/release-suggestion-prompt";
import { listItems } from "@/lib/repositories/item-repository";
import type { Item, ReleaseCandidate } from "@/lib/types";

function eligibleItems(items: Item[]): Item[] {
  return items.filter(
    (item) => item.finalDecision === undefined && item.initialClassification !== "keep"
  );
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ collectionId: string }> }
): Promise<Response> {
  const { collectionId } = await params;
  const items = eligibleItems(await listItems(collectionId));

  if (items.length === 0) {
    return NextResponse.json({ candidates: [] }, { status: 200 });
  }

  const response = await getGeminiClient().models.generateContent({
    model: GEMINI_MODEL,
    contents: JSON.stringify(
      items.map((item) => ({ itemId: item.id, title: item.title, category: item.category }))
    ),
    config: {
      systemInstruction: RELEASE_SUGGESTION_SYSTEM_PROMPT,
      tools: [{ functionDeclarations: [SUGGEST_RELEASE_CANDIDATES_TOOL] }],
      toolConfig: {
        functionCallingConfig: {
          mode: FunctionCallingConfigMode.ANY,
          allowedFunctionNames: ["suggest_release_candidates"],
        },
      },
    },
  });

  const args = response.functionCalls?.[0]?.args as { candidates?: ReleaseCandidate[] } | undefined;
  const validItemIds = new Set(items.map((item) => item.id));
  const itemNameById = new Map(items.map((item) => [item.id, item.title]));

  const candidates: ReleaseCandidate[] = (args?.candidates ?? [])
    .filter((candidate) => validItemIds.has(candidate.itemId))
    .map((candidate) => ({
      itemId: candidate.itemId,
      itemName: itemNameById.get(candidate.itemId) ?? "",
      reason: candidate.reason,
    }));

  return NextResponse.json({ candidates }, { status: 200 });
}
