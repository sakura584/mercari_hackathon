export function collectionPath(collectionId: string): string {
  return `collections/${collectionId}`;
}

export function itemsCollectionPath(collectionId: string): string {
  return `collections/${collectionId}/items`;
}

export function itemPath(collectionId: string, itemId: string): string {
  return `collections/${collectionId}/items/${itemId}`;
}

export function reflectionPath(collectionId: string, itemId: string): string {
  return `collections/${collectionId}/items/${itemId}/reflection/state`;
}

export function reflectionTurnsCollectionPath(
  collectionId: string,
  itemId: string
): string {
  return `collections/${collectionId}/items/${itemId}/reflection/state/turns`;
}

export function albumCollectionPath(collectionId: string): string {
  return `collections/${collectionId}/album`;
}

export function albumEntryPath(collectionId: string, memoryRecordId: string): string {
  return `collections/${collectionId}/album/${memoryRecordId}`;
}

export function likesCollectionPath(collectionId: string): string {
  return `collections/${collectionId}/likes`;
}

export function likePath(collectionId: string, likerId: string): string {
  return `collections/${collectionId}/likes/${likerId}`;
}

export function buyRequestsCollectionPath(collectionId: string): string {
  return `collections/${collectionId}/buy-requests`;
}

export function buyRequestPath(collectionId: string, buyRequestId: string): string {
  return `collections/${collectionId}/buy-requests/${buyRequestId}`;
}

export function commentsCollectionPath(collectionId: string): string {
  return `collections/${collectionId}/comments`;
}

export function commentPath(collectionId: string, commentId: string): string {
  return `collections/${collectionId}/comments/${commentId}`;
}
