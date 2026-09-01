import { NextResponse } from "next/server";
import { listPendingBuyRequests } from "@/lib/repositories/buy-request-repository";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ collectionId: string }> }
): Promise<Response> {
  const { collectionId } = await params;
  const buyRequests = await listPendingBuyRequests(collectionId);
  return NextResponse.json({ buyRequests }, { status: 200 });
}
