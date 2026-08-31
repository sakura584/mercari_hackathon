import { NextResponse } from "next/server";
import { listAlbumEntries } from "@/lib/repositories/album-repository";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
): Promise<Response> {
  const { sessionId } = await params;
  const entries = await listAlbumEntries(sessionId);
  return NextResponse.json({ entries }, { status: 200 });
}
