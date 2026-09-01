import type { BuyRequest, Collection, Comment, Item, ReleaseCandidate } from "./types";

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${url} failed: ${res.status}`);
  return res.json();
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} failed: ${res.status}`);
  return res.json();
}

export const collectionApiClient = {
  createCollection(input: { ownerName: string; title: string; coverImageUrl?: string }) {
    return postJson<Collection>("/api/collections", input);
  },

  async listCollections(): Promise<Collection[]> {
    const { collections } = await getJson<{ collections: Collection[] }>("/api/collections");
    return collections;
  },

  getCollection(collectionId: string) {
    return getJson<{ collection: Collection; items: Item[]; comments: Comment[] }>(
      `/api/collections/${collectionId}`
    );
  },

  async updateCollection(
    collectionId: string,
    input: { title?: string; body?: string; coverImageUrl?: string }
  ): Promise<Collection> {
    const res = await fetch(`/api/collections/${collectionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(`PATCH /api/collections/${collectionId} failed: ${res.status}`);
    return res.json();
  },

  extractItems(input: {
    collectionId: string;
    imageBase64: string;
    mimeType: string;
    mode?: "single" | "collection";
  }) {
    return postJson<{ items: Item[] }>("/api/items/extract", input);
  },

  like(collectionId: string, likerId: string) {
    return postJson<{ likeCount: number }>(`/api/collections/${collectionId}/like`, { likerId });
  },

  addComment(collectionId: string, input: { authorName: string; text: string }) {
    return postJson<Comment>(`/api/collections/${collectionId}/comments`, input);
  },

  createBuyRequest(collectionId: string, itemId: string, input: { fromName: string; price: number }) {
    return postJson<BuyRequest>(
      `/api/collections/${collectionId}/items/${itemId}/buy-requests`,
      input
    );
  },

  async listPendingBuyRequests(collectionId: string): Promise<BuyRequest[]> {
    const { buyRequests } = await getJson<{ buyRequests: BuyRequest[] }>(
      `/api/collections/${collectionId}/buy-requests`
    );
    return buyRequests;
  },

  submitDecision(
    collectionId: string,
    itemId: string,
    input: { decision: "keep" | "let_go" | "hold"; itemName: string; imageUrl: string }
  ) {
    return postJson<{ decision: string }>(
      `/api/collections/${collectionId}/items/${itemId}/decision`,
      input
    );
  },

  suggestRelease(collectionId: string) {
    return postJson<{ candidates: ReleaseCandidate[] }>(
      `/api/collections/${collectionId}/suggest-release`,
      {}
    );
  },
};

const MAX_DIMENSION = 1024;
const JPEG_QUALITY = 0.8;

export function resizeImageToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("failed to load image"));
    };

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("canvas 2d context not available"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
      resolve({ base64: dataUrl.split(",")[1] ?? "", mimeType: "image/jpeg" });
    };

    img.src = objectUrl;
  });
}

const LIKER_ID_KEY = "letting-go-liker-id";

export function getOrCreateLikerId(): string {
  const existing = window.localStorage.getItem(LIKER_ID_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  window.localStorage.setItem(LIKER_ID_KEY, id);
  return id;
}

const OWNER_NAME_KEY = "letting-go-owner-name";

export function getStoredOwnerName(): string {
  return window.localStorage.getItem(OWNER_NAME_KEY) ?? "";
}

export function storeOwnerName(name: string): void {
  window.localStorage.setItem(OWNER_NAME_KEY, name);
}
