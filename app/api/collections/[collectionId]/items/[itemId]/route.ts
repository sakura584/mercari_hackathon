import { NextResponse } from "next/server";
import { deleteItem, updateItemTitle } from "@/lib/repositories/item-repository";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ collectionId: string; itemId: string }> }
): Promise<Response> {
  const { collectionId, itemId } = await params;
  const body = await request.json().catch(() => null);

  if (!body || typeof body.title !== "string" || !body.title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  await updateItemTitle(collectionId, itemId, body.title);
  return new Response(null, { status: 204 });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ collectionId: string; itemId: string }> }
): Promise<Response> {
  const { collectionId, itemId } = await params;
  await deleteItem(collectionId, itemId);
  return new Response(null, { status: 204 });
}
