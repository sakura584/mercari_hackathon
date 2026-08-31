import type {
  FinalDecision,
  Item,
  ItemClassification,
  MemoryRecord,
  PurposeType,
  ReflectionState,
} from "./types";

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${url} failed: ${res.status}`);
  return res.json();
}

export const apiClient = {
  createSession(input: { purposeType: PurposeType; targetAmount?: number; note?: string }) {
    return postJson<{ id: string; purposeType: PurposeType; targetAmount?: number }>(
      "/api/sessions",
      input
    );
  },

  extractItems(input: { sessionId: string; imageBase64: string; mimeType: string }) {
    return postJson<{ items: Item[] }>("/api/items/extract", input);
  },

  async updateClassification(
    sessionId: string,
    itemId: string,
    classification: ItemClassification
  ): Promise<void> {
    const res = await fetch(`/api/sessions/${sessionId}/items/${itemId}/classification`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classification }),
    });
    if (!res.ok) throw new Error(`classification update failed: ${res.status}`);
  },

  startReflection(sessionId: string, itemId: string, itemName: string) {
    return postJson<ReflectionState>(
      `/api/sessions/${sessionId}/items/${itemId}/reflection`,
      { itemName }
    );
  },

  sendReflectionMessage(sessionId: string, itemId: string, message: string) {
    return postJson<
      | { action: "ask"; reflection: string; question: string }
      | { action: "complete"; reflection: string; summary: Partial<ReflectionState> }
    >(`/api/sessions/${sessionId}/items/${itemId}/reflection/messages`, { message });
  },

  submitDecision(
    sessionId: string,
    itemId: string,
    input: { decision: FinalDecision; itemName: string; imageUrl: string }
  ) {
    return postJson<{ decision: FinalDecision; albumEntry?: MemoryRecord }>(
      `/api/sessions/${sessionId}/items/${itemId}/decision`,
      input
    );
  },

  async getAlbum(sessionId: string): Promise<{ entries: MemoryRecord[] }> {
    const res = await fetch(`/api/sessions/${sessionId}/album`);
    if (!res.ok) throw new Error(`get album failed: ${res.status}`);
    return res.json();
  },
};
