import { getAdminFirestore } from "../firebase/admin";
import { collectionPath } from "../firestore-paths";
import type { Collection } from "../types";

export async function createCollection(input: {
  ownerName: string;
  title: string;
  coverImageUrl?: string;
}): Promise<Collection> {
  const db = getAdminFirestore();
  const ref = db.collection("collections").doc();
  const collection: Collection = {
    id: ref.id,
    ownerName: input.ownerName,
    title: input.title,
    coverImageUrl: input.coverImageUrl,
    createdAt: new Date().toISOString(),
    likeCount: 0,
  };
  await ref.set(collection);
  return collection;
}

export async function getCollection(collectionId: string): Promise<Collection | null> {
  const db = getAdminFirestore();
  const snapshot = await db.doc(collectionPath(collectionId)).get();
  if (!snapshot.exists) return null;
  return snapshot.data() as Collection;
}

export async function listCollections(): Promise<Collection[]> {
  const db = getAdminFirestore();
  const snapshot = await db.collection("collections").orderBy("createdAt", "desc").get();
  return snapshot.docs.map((doc) => doc.data() as Collection);
}
