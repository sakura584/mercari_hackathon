import { NextResponse } from "next/server";
import { updateItemClassification } from "@/lib/repositories/item-repository";
import type { ItemClassification } from "@/lib/types";

const VALID_CLASSIFICATIONS: ItemClassification[] = ["keep", "unsure", "releaseable"];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ sessionId: string; itemId: string }> }
): Promise<Response> {
  const { sessionId, itemId } = await params;
  const body = await request.json().catch(() => null);

  if (!body || !VALID_CLASSIFICATIONS.includes(body.classification)) {
    return NextResponse.json(
      { error: "classification must be one of " + VALID_CLASSIFICATIONS.join(", ") },
      { status: 400 }
    );
  }

  await updateItemClassification(sessionId, itemId, body.classification);
  return new Response(null, { status: 204 });
}
