import { getAdminFirestore } from "../firebase/admin";
import { reflectionPath, reflectionTurnsCollectionPath } from "../firestore-paths";
import { initialReflectionState } from "../reflection-state";
import type { ReflectionState, ReflectionTurn } from "../types";

export async function createReflection(
  collectionId: string,
  itemId: string,
  itemName: string
): Promise<ReflectionState> {
  const db = getAdminFirestore();
  const state = initialReflectionState(itemId, itemName);
  await db.doc(reflectionPath(collectionId, itemId)).set(state);
  return state;
}

export async function getReflectionState(
  collectionId: string,
  itemId: string
): Promise<ReflectionState | null> {
  const db = getAdminFirestore();
  const snapshot = await db.doc(reflectionPath(collectionId, itemId)).get();
  if (!snapshot.exists) return null;
  return snapshot.data() as ReflectionState;
}

export async function saveReflectionState(
  collectionId: string,
  itemId: string,
  state: ReflectionState
): Promise<void> {
  const db = getAdminFirestore();
  await db.doc(reflectionPath(collectionId, itemId)).set(state);
}

export async function appendReflectionTurn(
  collectionId: string,
  itemId: string,
  turn: Omit<ReflectionTurn, "reflectionId">
): Promise<void> {
  const db = getAdminFirestore();
  const ref = db.collection(reflectionTurnsCollectionPath(collectionId, itemId)).doc();
  const fullTurn: ReflectionTurn = { ...turn, reflectionId: ref.id };
  await ref.set(fullTurn);
}
