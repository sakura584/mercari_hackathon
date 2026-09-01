import { getAdminFirestore } from "../firebase/admin";
import { commentsCollectionPath } from "../firestore-paths";
import type { Comment } from "../types";

export async function createComment(input: {
  collectionId: string;
  authorName: string;
  text: string;
}): Promise<Comment> {
  const db = getAdminFirestore();
  const ref = db.collection(commentsCollectionPath(input.collectionId)).doc();
  const comment: Comment = {
    id: ref.id,
    collectionId: input.collectionId,
    authorName: input.authorName,
    text: input.text,
    createdAt: new Date().toISOString(),
  };
  await ref.set(comment);
  return comment;
}

export async function listComments(collectionId: string): Promise<Comment[]> {
  const db = getAdminFirestore();
  const snapshot = await db
    .collection(commentsCollectionPath(collectionId))
    .orderBy("createdAt", "asc")
    .get();
  return snapshot.docs.map((doc) => doc.data() as Comment);
}
