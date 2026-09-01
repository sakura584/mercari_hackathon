import { NextResponse } from "next/server";
import { updateBuyRequestStatus } from "@/lib/repositories/buy-request-repository";
import type { BuyRequestStatus } from "@/lib/types";

const SETTABLE_STATUSES: BuyRequestStatus[] = ["declined", "listed"];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ collectionId: string; buyRequestId: string }> }
): Promise<Response> {
  const { collectionId, buyRequestId } = await params;
  const body = await request.json().catch(() => null);

  if (!body || !SETTABLE_STATUSES.includes(body.status)) {
    return NextResponse.json(
      { error: "status must be one of " + SETTABLE_STATUSES.join(", ") },
      { status: 400 }
    );
  }

  await updateBuyRequestStatus(collectionId, buyRequestId, body.status);
  return new Response(null, { status: 204 });
}
