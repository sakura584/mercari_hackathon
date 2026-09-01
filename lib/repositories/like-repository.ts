import { FieldValue } from "firebase-admin/firestore";
import { getAdminFirestore } from "../firebase/admin";
import { collectionPath, likePath } from "../firestore-paths";

export async function addLike(collectionId: string, likerId: string): Promise<number> {
  const db = getAdminFirestore();
  const likeRef = db.doc(likePath(collectionId, likerId));
  const existing = await likeRef.get();

  if (!existing.exists) {
    await likeRef.set({ likerId, collectionId, createdAt: new Date().toISOString() });
    await db.doc(collectionPath(collectionId)).update({ likeCount: FieldValue.increment(1) });
  }

  const snapshot = await db.doc(collectionPath(collectionId)).get();
  return (snapshot.data()?.likeCount as number | undefined) ?? 0;
}
