import { NextResponse } from "next/server";
import { createReflection } from "@/lib/repositories/reflection-repository";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ collectionId: string; itemId: string }> }
): Promise<Response> {
  const { collectionId, itemId } = await params;
  const body = await request.json().catch(() => null);

  if (!body?.itemName) {
    return NextResponse.json({ error: "itemName is required" }, { status: 400 });
  }

  const state = await createReflection(collectionId, itemId, body.itemName);
  return NextResponse.json(state, { status: 201 });
}
