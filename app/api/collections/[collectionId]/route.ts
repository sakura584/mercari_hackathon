import { NextResponse } from "next/server";
import { getCollection } from "@/lib/repositories/collection-repository";
import { listItems } from "@/lib/repositories/item-repository";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ collectionId: string }> }
): Promise<Response> {
  const { collectionId } = await params;
  const collection = await getCollection(collectionId);

  if (!collection) {
    return NextResponse.json({ error: "collection not found" }, { status: 404 });
  }

  const items = await listItems(collectionId);
  return NextResponse.json({ collection, items }, { status: 200 });
}
