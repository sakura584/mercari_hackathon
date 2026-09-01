"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  collectionApiClient,
  getOrCreateLikerId,
  getStoredOwnerName,
  resizeImageToBase64,
  storeOwnerName,
} from "@/lib/collection-api-client";
import type { BuyRequest, Collection, Comment as BackendComment, Item } from "@/lib/types";
import type { CollectionPost, DraftTag, ItemTag, MyPageTab } from "@/lib/collection-types";
import { CollectionCreateScreen } from "./CollectionCreateScreen";
import { CollectionMyPageScreen } from "./CollectionMyPageScreen";
import { CollectionDetailScreen } from "./CollectionDetailScreen";
import { CollectionNotificationScreen } from "./CollectionNotificationScreen";
import { CollectionSellScreen } from "./CollectionSellScreen";
import { CollectionSellCompleteScreen } from "./CollectionSellCompleteScreen";

type Screen = "create" | "mypage" | "detail" | "notification" | "sell" | "sell-complete";

const LIKED_IDS_KEY = "letting-go-liked-collection-ids";

function readLikedIds(): Set<string> {
  try {
    return new Set(JSON.parse(window.localStorage.getItem(LIKED_IDS_KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

function writeLikedIds(ids: Set<string>) {
  window.localStorage.setItem(LIKED_IDS_KEY, JSON.stringify([...ids]));
}

function itemToTag(item: Item, buyRequests: BuyRequest[]): ItemTag {
  return {
    id: item.id,
    x: item.x ?? 50,
    y: item.y ?? 50,
    name: item.title,
    category: item.category,
    status: item.finalDecision === "let_go" ? "出品中" : "未出品",
    wants: buyRequests
      .filter((r) => r.itemId === item.id)
      .map((r) => ({ from: r.fromName, price: r.price, at: r.createdAt })),
  };
}

function toCollectionPost(
  collection: Collection,
  items: Item[],
  comments: BackendComment[],
  buyRequests: BuyRequest[],
  liked: boolean
): CollectionPost {
  return {
    id: collection.id,
    user: { name: collection.ownerName, avatar: collection.ownerName.charAt(0) || "?" },
    photo: collection.coverImageUrl ?? items[0]?.imageUrl ?? null,
    title: collection.title,
    body: collection.body ?? "",
    postedAt: new Date(collection.createdAt).toLocaleString("ja-JP"),
    likes: collection.likeCount,
    liked,
    comments: comments.map((c) => ({ user: c.authorName, text: c.text })),
    tags: items.map((item) => itemToTag(item, buyRequests)),
  };
}

function emptyDraftLocal() {
  return {
    photoFile: null as File | null,
    photoPreview: null as string | null,
    title: "",
    body: "",
    tags: [] as DraftTag[],
  };
}

export function CollectionApp({
  initialScreen,
  onExit,
}: {
  initialScreen: "create" | "mypage";
  onExit: () => void;
}) {
  const [ownerName, setOwnerName] = useState("");
  const [ownerNameLoaded, setOwnerNameLoaded] = useState(false);

  useEffect(() => {
    // ログイン機能はないため、表示名は初回アクセス時に自動採番してlocalStorageに保持する
    // （collection.htmlの固定デモユーザーに相当。ユーザーへの入力は求めない）。
    const stored = getStoredOwnerName();
    const name = stored || "ゲスト";
    if (!stored) storeOwnerName(name);
    setOwnerName(name);
    setOwnerNameLoaded(true);
  }, []);

  const likerId = useMemo(() => (typeof window !== "undefined" ? getOrCreateLikerId() : ""), []);

  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [draft, setDraft] = useState(emptyDraftLocal);
  const [draftCollectionId, setDraftCollectionId] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [collections, setCollections] = useState<Collection[]>([]);
  const [collectionPhotos, setCollectionPhotos] = useState<Record<string, string | null>>({});
  const [collectionTagCounts, setCollectionTagCounts] = useState<Record<string, number>>({});
  const [myPageTab, setMyPageTab] = useState<MyPageTab>("collection");

  const [currentDetailId, setCurrentDetailId] = useState<string | null>(null);
  const [detailItems, setDetailItems] = useState<Item[]>([]);
  const [detailComments, setDetailComments] = useState<BackendComment[]>([]);
  const [detailBuyRequests, setDetailBuyRequests] = useState<BuyRequest[]>([]);
  const [likedIds, setLikedIds] = useState<Set<string>>(() =>
    typeof window !== "undefined" ? readLikedIds() : new Set()
  );

  const [activeBuyItemId, setActiveBuyItemId] = useState<string | null>(null);
  const [buyPrice, setBuyPrice] = useState(3000);
  const [sheet, setSheet] = useState<"photo" | "buy" | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [notifItem, setNotifItem] = useState<Item | null>(null);
  const [notifBuyRequest, setNotifBuyRequest] = useState<BuyRequest | null>(null);
  const [roleSwitchVisible, setRoleSwitchVisible] = useState(false);
  const [completeMessage, setCompleteMessage] = useState("");

  const currentDetailCollection = collections.find((c) => c.id === currentDetailId) ?? null;
  const currentDetailPost = currentDetailCollection
    ? toCollectionPost(
        currentDetailCollection,
        detailItems,
        detailComments,
        detailBuyRequests,
        likedIds.has(currentDetailCollection.id)
      )
    : null;
  const buyTargetItem = detailItems.find((i) => i.id === activeBuyItemId) ?? null;

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1800);
  }

  async function refreshCollectionsList() {
    const list = await collectionApiClient.listCollections();
    setCollections(list);
    const details = await Promise.all(list.map((c) => collectionApiClient.getCollection(c.id)));
    const photos: Record<string, string | null> = {};
    const counts: Record<string, number> = {};
    list.forEach((c, i) => {
      photos[c.id] = c.coverImageUrl ?? details[i].items[0]?.imageUrl ?? null;
      counts[c.id] = details[i].items.length;
    });
    setCollectionPhotos(photos);
    setCollectionTagCounts(counts);
  }

  async function startCreateDraft() {
    const collection = await collectionApiClient.createCollection({
      ownerName,
      title: "無題のコレクション",
    });
    setDraftCollectionId(collection.id);
  }

  useEffect(() => {
    if (!ownerNameLoaded || !ownerName) return;
    if (screen === "mypage") {
      refreshCollectionsList();
    } else if (screen === "create" && !draftCollectionId) {
      startCreateDraft();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, ownerNameLoaded, ownerName]);

  async function openDetail(id: string) {
    setCurrentDetailId(id);
    setRoleSwitchVisible(false);
    const detail = await collectionApiClient.getCollection(id);
    setDetailItems(detail.items);
    setDetailComments(detail.comments);
    setDetailBuyRequests(await collectionApiClient.listPendingBuyRequests(id));
    setScreen("detail");
  }

  function goToMyPage(tab: MyPageTab = "collection") {
    setMyPageTab(tab);
    setScreen("mypage");
  }

  function setDraftPhotoFile(file: File) {
    setDraft((d) => ({ ...d, photoFile: file, photoPreview: URL.createObjectURL(file) }));
    setSheet(null);
  }

  async function startExtraction() {
    if (!draft.photoFile || !draftCollectionId) return;
    setExtracting(true);
    setLoadingText("写真を解析しています");
    try {
      const { base64, mimeType } = await resizeImageToBase64(draft.photoFile);
      setLoadingText("商品を認識しています");
      const { items } = await collectionApiClient.extractItems({
        collectionId: draftCollectionId,
        imageBase64: base64,
        mimeType,
        mode: "collection",
      });
      setDraft((d) => ({
        ...d,
        tags: items.map((item) => ({
          id: item.id,
          x: item.x ?? 50,
          y: item.y ?? 50,
          name: item.title,
          category: item.category,
          included: true,
        })),
      }));
    } finally {
      setExtracting(false);
    }
  }

  function toggleTagIncluded(id: string) {
    setDraft((d) => ({
      ...d,
      tags: d.tags.map((t) => (t.id === id ? { ...t, included: !t.included } : t)),
    }));
  }

  function updateTagName(id: string, name: string) {
    setDraft((d) => ({ ...d, tags: d.tags.map((t) => (t.id === id ? { ...t, name } : t)) }));
  }

  async function submitCollection() {
    if (draft.tags.length === 0 || !draftCollectionId) return;
    await collectionApiClient.updateCollection(draftCollectionId, {
      title: draft.title || "無題のコレクション",
      body: draft.body,
    });
    setDraft(emptyDraftLocal());
    setDraftCollectionId(null);
    await goToMyPage("collection");
  }

  async function toggleLike() {
    if (!currentDetailCollection) return;
    const id = currentDetailCollection.id;
    const alreadyLiked = likedIds.has(id);
    if (alreadyLiked) return; // 二重いいねはUI側でも防ぐ（バックエンドも冪等）
    const { likeCount } = await collectionApiClient.like(id, likerId);
    setCollections((prev) => prev.map((c) => (c.id === id ? { ...c, likeCount } : c)));
    const next = new Set(likedIds);
    next.add(id);
    setLikedIds(next);
    writeLikedIds(next);
  }

  async function sendComment(text: string) {
    if (!currentDetailCollection) return;
    const comment = await collectionApiClient.addComment(currentDetailCollection.id, {
      authorName: ownerName || "ゲスト",
      text,
    });
    setDetailComments((prev) => [...prev, comment]);
  }

  function openBuySheet(itemId: string) {
    setActiveBuyItemId(itemId);
    setBuyPrice(3000);
    setSheet("buy");
  }

  async function submitBuy() {
    if (!currentDetailCollection || !activeBuyItemId) return;
    const item = detailItems.find((i) => i.id === activeBuyItemId);
    if (!item) return;
    const buyRequest = await collectionApiClient.createBuyRequest(
      currentDetailCollection.id,
      activeBuyItemId,
      { fromName: "たなか（デモ購入者）", price: buyPrice }
    );
    setDetailBuyRequests((prev) => [buyRequest, ...prev]);
    setSheet(null);
    showToast("伝えました");
    window.setTimeout(() => setRoleSwitchVisible(true), 500);
  }

  function handleSwitchRole() {
    const pending = detailBuyRequests[0];
    if (!pending) return;
    const item = detailItems.find((i) => i.id === pending.itemId);
    if (!item) return;
    setNotifItem(item);
    setNotifBuyRequest(pending);
    setScreen("notification");
  }

  function declineList() {
    showToast("また今度、出品するか検討できます");
    goToMyPage("collection");
  }

  async function completeSell(values: { name: string; description: string; price: number }) {
    if (!currentDetailCollection || !notifItem) return;
    await collectionApiClient.submitDecision(currentDetailCollection.id, notifItem.id, {
      decision: "let_go",
      itemName: values.name,
      imageUrl: notifItem.imageUrl,
    });
    setCompleteMessage(`「${values.name}」の出品が完了しました。買いたいと伝えてくれた人に届きます。`);
    setScreen("sell-complete");
  }

  if (!ownerNameLoaded) return null;

  let content: ReactNode = null;
  if (screen === "create") {
    content = (
      <CollectionCreateScreen
        draft={{ photo: draft.photoPreview, title: draft.title, body: draft.body, tags: draft.tags }}
        extracting={extracting}
        onBack={onExit}
        onOpenPhotoSheet={() => setSheet("photo")}
        onStartExtraction={startExtraction}
        onToggleTagIncluded={toggleTagIncluded}
        onUpdateTagName={updateTagName}
        onChangeTitle={(title) => setDraft((d) => ({ ...d, title }))}
        onChangeBody={(body) => setDraft((d) => ({ ...d, body }))}
        onSubmit={submitCollection}
      />
    );
  } else if (screen === "mypage") {
    const posts: CollectionPost[] = collections.map((c) => ({
      id: c.id,
      user: { name: c.ownerName, avatar: c.ownerName.charAt(0) || "?" },
      photo: collectionPhotos[c.id] ?? null,
      title: c.title,
      body: c.body ?? "",
      postedAt: new Date(c.createdAt).toLocaleString("ja-JP"),
      likes: c.likeCount,
      liked: likedIds.has(c.id),
      comments: [],
      tags: Array.from({ length: collectionTagCounts[c.id] ?? 0 }, (_, i) => ({
        id: `${c.id}-${i}`,
        x: 0,
        y: 0,
        name: "",
        category: "",
        status: "未出品" as const,
        wants: [],
      })),
    }));
    content = (
      <CollectionMyPageScreen
        user={{ name: ownerName, avatar: ownerName.charAt(0) || "?" }}
        tab={myPageTab}
        collections={posts}
        onBack={onExit}
        onChangeTab={setMyPageTab}
        onOpenDetail={openDetail}
      />
    );
  } else if (screen === "detail" && currentDetailPost) {
    content = (
      <CollectionDetailScreen
        post={currentDetailPost}
        onBack={() => goToMyPage("collection")}
        onToggleLike={toggleLike}
        onSendComment={sendComment}
        onOpenBuySheet={openBuySheet}
        showRoleSwitchBanner={roleSwitchVisible}
        onSwitchRole={handleSwitchRole}
      />
    );
  } else if (screen === "notification" && notifItem && notifBuyRequest) {
    content = (
      <CollectionNotificationScreen
        tagName={notifItem.title}
        buyerName={notifBuyRequest.fromName}
        buyerAvatar={notifBuyRequest.fromName.charAt(0)}
        price={notifBuyRequest.price}
        onBack={() => goToMyPage("collection")}
        onDecline={declineList}
        onStartSell={() => setScreen("sell")}
      />
    );
  } else if (screen === "sell" && notifItem && notifBuyRequest) {
    content = (
      <CollectionSellScreen
        photo={notifItem.imageUrl}
        initialName={notifItem.title}
        initialDescription={currentDetailCollection?.body ?? ""}
        category={notifItem.category}
        initialPrice={notifBuyRequest.price}
        onBack={() => setScreen("notification")}
        onComplete={completeSell}
      />
    );
  } else if (screen === "sell-complete") {
    content = (
      <CollectionSellCompleteScreen message={completeMessage} onBackToCollection={() => goToMyPage("collection")} />
    );
  }

  return (
    <>
      {content}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) setDraftPhotoFile(file);
          e.target.value = "";
        }}
      />

      <div className={`sheet-backdrop${sheet ? " open" : ""}`} onClick={() => setSheet(null)} />
      <div className={`sheet${sheet === "photo" ? " open" : ""}`}>
        <div className="sheet-handle" />
        <div className="sheet-title">写真を追加</div>
        <button type="button" className="sheet-option" onClick={() => fileInputRef.current?.click()}>
          📷 カメラで撮影 / アルバムから選ぶ
        </button>
        <button type="button" className="sheet-cancel" onClick={() => setSheet(null)}>
          キャンセル
        </button>
      </div>
      <div className={`sheet${sheet === "buy" ? " open" : ""}`}>
        <div className="sheet-handle" />
        <div className="sheet-title">この商品を買いたいと伝えます</div>
        <p className="hero-sub" style={{ marginBottom: 12 }}>
          対象：<b>{buyTargetItem?.title}</b>
        </p>
        <div className="draft-field">
          <label>希望金額</label>
          <div className="draft-price-wrap">
            <span>¥</span>
            <input
              type="number"
              value={buyPrice}
              onChange={(e) => setBuyPrice(parseInt(e.target.value, 10) || 0)}
            />
          </div>
          <input
            type="range"
            className="collection-price-slider"
            min={500}
            max={30000}
            step={100}
            value={buyPrice}
            onChange={(e) => setBuyPrice(parseInt(e.target.value, 10))}
          />
        </div>
        <p className="collection-sheet-note">
          {currentDetailCollection?.ownerName}さんに通知されます。出品するかどうかは相手が決めます。
        </p>
        <button type="button" className="cta" onClick={submitBuy}>
          送る
        </button>
      </div>

      {extracting ? (
        <div className="collection-loading-overlay">
          <div className="spinner" />
          <div className="collection-loading-text">{loadingText}</div>
        </div>
      ) : null}

      {toast ? <div className="collection-toast">{toast}</div> : null}
    </>
  );
}
