import { NextResponse } from "next/server";
import { getCollection } from "@/lib/repositories/collection-repository";
import { listItems } from "@/lib/repositories/item-repository";
import { listComments } from "@/lib/repositories/comment-repository";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ collectionId: string }> }
): Promise<Response> {
  const { collectionId } = await params;
  const collection = await getCollection(collectionId);

  if (!collection) {
    return NextResponse.json({ error: "collection not found" }, { status: 404 });
  }

  const [items, comments] = await Promise.all([
    listItems(collectionId),
    listComments(collectionId),
  ]);

  return NextResponse.json({ collection, items, comments }, { status: 200 });
}
