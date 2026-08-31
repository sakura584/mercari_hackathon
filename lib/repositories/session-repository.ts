import { getAdminFirestore } from "../firebase/admin";
import { sessionPath } from "../firestore-paths";
import type { PurposeType, Session } from "../types";

export async function createSession(input: {
  purposeType: PurposeType;
  targetAmount?: number;
  note?: string;
}): Promise<Session> {
  const db = getAdminFirestore();
  const ref = db.collection("sessions").doc();
  const session: Session = {
    id: ref.id,
    purposeType: input.purposeType,
    targetAmount: input.targetAmount,
    note: input.note,
    createdAt: new Date().toISOString(),
  };
  await ref.set(session);
  return session;
}

export async function getSession(sessionId: string): Promise<Session | null> {
  const db = getAdminFirestore();
  const snapshot = await db.doc(sessionPath(sessionId)).get();
  if (!snapshot.exists) return null;
  return snapshot.data() as Session;
}
