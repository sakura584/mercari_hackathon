import { NextResponse } from "next/server";
import { createBuyRequest } from "@/lib/repositories/buy-request-repository";
import { listItems } from "@/lib/repositories/item-repository";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ collectionId: string; itemId: string }> }
): Promise<Response> {
  const { collectionId, itemId } = await params;
  const body = await request.json().catch(() => null);

  if (!body || typeof body.fromName !== "string" || !body.fromName || typeof body.price !== "number") {
    return NextResponse.json({ error: "fromName and price are required" }, { status: 400 });
  }

  const items = await listItems(collectionId);
  const item = items.find((candidate) => candidate.id === itemId);
  if (!item) {
    return NextResponse.json({ error: "item not found" }, { status: 404 });
  }

  const buyRequest = await createBuyRequest({
    collectionId,
    itemId,
    itemName: item.title,
    fromName: body.fromName,
    price: body.price,
  });

  return NextResponse.json(buyRequest, { status: 201 });
}
