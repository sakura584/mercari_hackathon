import { getAdminFirestore } from "../firebase/admin";
import { collectionPath } from "../firestore-paths";
import type { Collection } from "../types";

export async function createCollection(input: {
  ownerName: string;
  title: string;
  body?: string;
  coverImageUrl?: string;
}): Promise<Collection> {
  const db = getAdminFirestore();
  const ref = db.collection("collections").doc();
  const collection: Collection = {
    id: ref.id,
    ownerName: input.ownerName,
    title: input.title,
    body: input.body,
    coverImageUrl: input.coverImageUrl,
    createdAt: new Date().toISOString(),
    likeCount: 0,
  };
  await ref.set(collection);
  return collection;
}

export async function updateCollection(
  collectionId: string,
  input: { title?: string; body?: string; coverImageUrl?: string }
): Promise<void> {
  const db = getAdminFirestore();
  const updates: Record<string, string> = {};
  if (input.title !== undefined) updates.title = input.title;
  if (input.body !== undefined) updates.body = input.body;
  if (input.coverImageUrl !== undefined) updates.coverImageUrl = input.coverImageUrl;
  if (Object.keys(updates).length === 0) return;
  await db.doc(collectionPath(collectionId)).update(updates);
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
