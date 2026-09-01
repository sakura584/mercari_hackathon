import { NextResponse } from "next/server";
import { createComment } from "@/lib/repositories/comment-repository";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ collectionId: string }> }
): Promise<Response> {
  const { collectionId } = await params;
  const body = await request.json().catch(() => null);

  if (
    !body ||
    typeof body.authorName !== "string" ||
    !body.authorName ||
    typeof body.text !== "string" ||
    !body.text
  ) {
    return NextResponse.json({ error: "authorName and text are required" }, { status: 400 });
  }

  const comment = await createComment({
    collectionId,
    authorName: body.authorName,
    text: body.text,
  });

  return NextResponse.json(comment, { status: 201 });
}
