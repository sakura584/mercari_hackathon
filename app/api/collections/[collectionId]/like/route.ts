import { NextResponse } from "next/server";
import { addLike } from "@/lib/repositories/like-repository";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ collectionId: string }> }
): Promise<Response> {
  const { collectionId } = await params;
  const body = await request.json().catch(() => null);

  if (!body || typeof body.likerId !== "string" || !body.likerId) {
    return NextResponse.json({ error: "likerId is required" }, { status: 400 });
  }

  const likeCount = await addLike(collectionId, body.likerId);
  return NextResponse.json({ likeCount }, { status: 200 });
}
