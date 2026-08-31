import { NextResponse } from "next/server";
import { createSession } from "@/lib/repositories/session-repository";
import type { PurposeType } from "@/lib/types";

const VALID_PURPOSE_TYPES: PurposeType[] = [
  "earn_money",
  "declutter",
  "preserve_memories",
  "consider_letting_go",
  "other",
];

export async function POST(request: Request): Promise<Response> {
  const body = await request.json().catch(() => null);

  if (!body || !VALID_PURPOSE_TYPES.includes(body.purposeType)) {
    return NextResponse.json(
      { error: "purposeType must be one of " + VALID_PURPOSE_TYPES.join(", ") },
      { status: 400 }
    );
  }

  const session = await createSession({
    purposeType: body.purposeType,
    targetAmount: typeof body.targetAmount === "number" ? body.targetAmount : undefined,
    note: typeof body.note === "string" ? body.note : undefined,
  });

  return NextResponse.json(session, { status: 201 });
}
