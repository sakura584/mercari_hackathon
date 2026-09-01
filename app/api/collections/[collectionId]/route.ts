import { NextResponse } from "next/server";
import { getCollection, updateCollection } from "@/lib/repositories/collection-repository";
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ collectionId: string }> }
): Promise<Response> {
  const { collectionId } = await params;
  const body = await request.json().catch(() => null);

  if (!body) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  await updateCollection(collectionId, {
    title: typeof body.title === "string" ? body.title : undefined,
    body: typeof body.body === "string" ? body.body : undefined,
    coverImageUrl: typeof body.coverImageUrl === "string" ? body.coverImageUrl : undefined,
  });

  const collection = await getCollection(collectionId);
  return NextResponse.json(collection, { status: 200 });
}
