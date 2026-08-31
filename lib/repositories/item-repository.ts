import { getAdminFirestore } from "../firebase/admin";
import { itemPath, itemsCollectionPath } from "../firestore-paths";
import { estimatePrice } from "../pricing";
import type { FinalDecision, Item, ItemClassification } from "../types";

export async function createItem(input: {
  sessionId: string;
  imageUrl: string;
  sourceImageId?: string;
  title: string;
  category: string;
}): Promise<Item> {
  const db = getAdminFirestore();
  const ref = db.collection(itemsCollectionPath(input.sessionId)).doc();
  const item: Item = {
    id: ref.id,
    sessionId: input.sessionId,
    imageUrl: input.imageUrl,
    sourceImageId: input.sourceImageId,
    title: input.title,
    category: input.category,
    estimatedPrice: estimatePrice(input.category),
  };
  await ref.set(item);
  return item;
}

export async function listItems(sessionId: string): Promise<Item[]> {
  const db = getAdminFirestore();
  const snapshot = await db.collection(itemsCollectionPath(sessionId)).get();
  return snapshot.docs.map((doc) => doc.data() as Item);
}

export async function updateItemClassification(
  sessionId: string,
  itemId: string,
  classification: ItemClassification
): Promise<void> {
  const db = getAdminFirestore();
  await db.doc(itemPath(sessionId, itemId)).update({
    initialClassification: classification,
  });
}

export async function updateItemDecision(
  sessionId: string,
  itemId: string,
  decision: FinalDecision
): Promise<void> {
  const db = getAdminFirestore();
  await db.doc(itemPath(sessionId, itemId)).update({ finalDecision: decision });
}
