import { NextResponse } from "next/server";
import { updateItemDecision } from "@/lib/repositories/item-repository";
import { getReflectionState } from "@/lib/repositories/reflection-repository";
import { generateMemoryRecordText } from "@/lib/memory-record-generator";
import { createAlbumEntry } from "@/lib/repositories/album-repository";
import type { FinalDecision } from "@/lib/types";

const VALID_DECISIONS: FinalDecision[] = ["keep", "let_go", "hold"];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string; itemId: string }> }
): Promise<Response> {
  const { sessionId, itemId } = await params;
  const body = await request.json().catch(() => null);

  if (!body || !VALID_DECISIONS.includes(body.decision) || !body.itemName || !body.imageUrl) {
    return NextResponse.json(
      { error: "decision, itemName, imageUrl are required" },
      { status: 400 }
    );
  }

  await updateItemDecision(sessionId, itemId, body.decision);

  if (body.decision !== "let_go") {
    return NextResponse.json({ decision: body.decision }, { status: 200 });
  }

  const reflectionState = await getReflectionState(sessionId, itemId);
  const text = await generateMemoryRecordText(body.itemName, reflectionState);

  const albumEntry = await createAlbumEntry(sessionId, {
    itemId,
    itemName: body.itemName,
    imageUrl: body.imageUrl,
    episode: text.episode,
    memory: text.memory,
    reasonForLettingGo: text.reasonForLettingGo,
    tags: text.tags,
  });

  return NextResponse.json({ decision: body.decision, albumEntry }, { status: 201 });
}
