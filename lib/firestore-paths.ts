export function sessionPath(sessionId: string): string {
  return `sessions/${sessionId}`;
}

export function itemsCollectionPath(sessionId: string): string {
  return `sessions/${sessionId}/items`;
}

export function itemPath(sessionId: string, itemId: string): string {
  return `sessions/${sessionId}/items/${itemId}`;
}

export function reflectionPath(sessionId: string, itemId: string): string {
  return `sessions/${sessionId}/items/${itemId}/reflection/state`;
}

export function reflectionTurnsCollectionPath(
  sessionId: string,
  itemId: string
): string {
  return `sessions/${sessionId}/items/${itemId}/reflection/state/turns`;
}

export function albumCollectionPath(sessionId: string): string {
  return `sessions/${sessionId}/album`;
}

export function albumEntryPath(sessionId: string, memoryRecordId: string): string {
  return `sessions/${sessionId}/album/${memoryRecordId}`;
}
