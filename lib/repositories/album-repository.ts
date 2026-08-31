import { getAdminFirestore } from "../firebase/admin";
import { albumCollectionPath } from "../firestore-paths";
import type { MemoryRecord } from "../types";

export async function createAlbumEntry(
  sessionId: string,
  input: Omit<MemoryRecord, "id" | "createdAt">
): Promise<MemoryRecord> {
  const db = getAdminFirestore();
  const ref = db.collection(albumCollectionPath(sessionId)).doc();
  const entry: MemoryRecord = {
    ...input,
    id: ref.id,
    createdAt: new Date().toISOString(),
  };
  await ref.set(entry);
  return entry;
}

export async function listAlbumEntries(sessionId: string): Promise<MemoryRecord[]> {
  const db = getAdminFirestore();
  const snapshot = await db
    .collection(albumCollectionPath(sessionId))
    .orderBy("createdAt", "desc")
    .get();
  return snapshot.docs.map((doc) => doc.data() as MemoryRecord);
}
