import { getAdminFirestore } from "../firebase/admin";
import { buyRequestPath, buyRequestsCollectionPath } from "../firestore-paths";
import type { BuyRequest, BuyRequestStatus } from "../types";

export async function createBuyRequest(input: {
  collectionId: string;
  itemId: string;
  itemName: string;
  fromName: string;
  price: number;
}): Promise<BuyRequest> {
  const db = getAdminFirestore();
  const ref = db.collection(buyRequestsCollectionPath(input.collectionId)).doc();
  const buyRequest: BuyRequest = {
    id: ref.id,
    collectionId: input.collectionId,
    itemId: input.itemId,
    itemName: input.itemName,
    fromName: input.fromName,
    price: input.price,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
  await ref.set(buyRequest);
  return buyRequest;
}

export async function listPendingBuyRequests(collectionId: string): Promise<BuyRequest[]> {
  const db = getAdminFirestore();
  const snapshot = await db.collection(buyRequestsCollectionPath(collectionId)).get();
  return snapshot.docs
    .map((doc) => doc.data() as BuyRequest)
    .filter((buyRequest) => buyRequest.status === "pending")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function updateBuyRequestStatus(
  collectionId: string,
  buyRequestId: string,
  status: BuyRequestStatus
): Promise<void> {
  const db = getAdminFirestore();
  await db.doc(buyRequestPath(collectionId, buyRequestId)).update({ status });
}
