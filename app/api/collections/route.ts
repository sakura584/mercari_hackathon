import { NextResponse } from "next/server";
import { createCollection, listCollections } from "@/lib/repositories/collection-repository";

export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null);

  if (!body || typeof body.title !== "string" || !body.title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  if (typeof body.ownerName !== "string" || !body.ownerName) {
    return NextResponse.json({ error: "ownerName is required" }, { status: 400 });
  }

  const collection = await createCollection({
    ownerName: body.ownerName,
    title: body.title,
    coverImageUrl: typeof body.coverImageUrl === "string" ? body.coverImageUrl : undefined,
  });

  return NextResponse.json(collection, { status: 201 });
}

export async function GET(): Promise<Response> {
  const collections = await listCollections();
  return NextResponse.json({ collections }, { status: 200 });
}
