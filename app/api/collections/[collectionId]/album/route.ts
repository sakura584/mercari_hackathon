import { NextResponse } from "next/server";
import { listAlbumEntries } from "@/lib/repositories/album-repository";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ collectionId: string }> }
): Promise<Response> {
  const { collectionId } = await params;
  const entries = await listAlbumEntries(collectionId);
  return NextResponse.json({ entries }, { status: 200 });
}
