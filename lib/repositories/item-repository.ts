import { getAdminFirestore } from "../firebase/admin";
import { itemPath, itemsCollectionPath } from "../firestore-paths";
import { estimatePrice } from "../pricing";
import type { FinalDecision, Item, ItemClassification } from "../types";

export async function createItem(input: {
  collectionId: string;
  imageUrl: string;
  sourceImageId?: string;
  title: string;
  category: string;
  x?: number;
  y?: number;
}): Promise<Item> {
  const db = getAdminFirestore();
  const ref = db.collection(itemsCollectionPath(input.collectionId)).doc();
  const item: Item = {
    id: ref.id,
    collectionId: input.collectionId,
    imageUrl: input.imageUrl,
    sourceImageId: input.sourceImageId,
    title: input.title,
    category: input.category,
    estimatedPrice: estimatePrice(input.category),
    x: input.x,
    y: input.y,
  };
  await ref.set(item);
  return item;
}

export async function listItems(collectionId: string): Promise<Item[]> {
  const db = getAdminFirestore();
  const snapshot = await db.collection(itemsCollectionPath(collectionId)).get();
  return snapshot.docs.map((doc) => doc.data() as Item);
}

export async function updateItemClassification(
  collectionId: string,
  itemId: string,
  classification: ItemClassification
): Promise<void> {
  const db = getAdminFirestore();
  await db.doc(itemPath(collectionId, itemId)).update({
    initialClassification: classification,
  });
}

export async function updateItemDecision(
  collectionId: string,
  itemId: string,
  decision: FinalDecision
): Promise<void> {
  const db = getAdminFirestore();
  await db.doc(itemPath(collectionId, itemId)).update({ finalDecision: decision });
}

export async function updateItemTitle(
  collectionId: string,
  itemId: string,
  title: string
): Promise<void> {
  const db = getAdminFirestore();
  await db.doc(itemPath(collectionId, itemId)).update({ title });
}

export async function deleteItem(collectionId: string, itemId: string): Promise<void> {
  const db = getAdminFirestore();
  await db.doc(itemPath(collectionId, itemId)).delete();
}
