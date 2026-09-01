"use client";

import { useRef, useState, type ReactNode } from "react";
import { currentUser, demoBuyer, mockExtractCandidates } from "@/lib/collection-mock-data";
import type { CollectionDraft, CollectionPost, ItemTag, MyPageTab } from "@/lib/collection-types";
import { CollectionCreateScreen } from "./CollectionCreateScreen";
import { CollectionMyPageScreen } from "./CollectionMyPageScreen";
import { CollectionDetailScreen } from "./CollectionDetailScreen";
import { CollectionNotificationScreen } from "./CollectionNotificationScreen";
import { CollectionSellScreen } from "./CollectionSellScreen";
import { CollectionSellCompleteScreen } from "./CollectionSellCompleteScreen";

type Screen = "create" | "mypage" | "detail" | "notification" | "sell" | "sell-complete";

function emptyDraft(): CollectionDraft {
  return { photo: null, title: "", body: "", tags: [] };
}

export function CollectionApp({
  initialScreen,
  onExit,
  collections,
  onCollectionsChange,
}: {
  initialScreen: "create" | "mypage";
  onExit: () => void;
  collections: CollectionPost[];
  onCollectionsChange: (updater: (prev: CollectionPost[]) => CollectionPost[]) => void;
}) {
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [draft, setDraft] = useState<CollectionDraft>(emptyDraft);
  const [myPageTab, setMyPageTab] = useState<MyPageTab>("collection");
  const [currentDetailId, setCurrentDetailId] = useState<string | null>(null);
  const [notifTarget, setNotifTarget] = useState<{ collectionId: string; tagId: string } | null>(null);
  const [buyTagId, setBuyTagId] = useState<string | null>(null);
  const [buyPrice, setBuyPrice] = useState(3000);
  const [sheet, setSheet] = useState<"photo" | "buy" | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const [roleSwitchVisible, setRoleSwitchVisible] = useState(false);
  const [completeMessage, setCompleteMessage] = useState("");
  const tagIdCounter = useRef(100);

  const currentDetail = collections.find((c) => c.id === currentDetailId) ?? null;
  const notifCollection = notifTarget
    ? collections.find((c) => c.id === notifTarget.collectionId) ?? null
    : null;
  const notifTag = notifCollection && notifTarget
    ? notifCollection.tags.find((t) => t.id === notifTarget.tagId) ?? null
    : null;
  const notifWant = notifTag && notifTag.wants.length > 0 ? notifTag.wants[notifTag.wants.length - 1] : null;
  const buyTargetTag = currentDetail?.tags.find((t) => t.id === buyTagId) ?? null;

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 1800);
  }

  function goToMyPage(tab: MyPageTab = "collection") {
    setMyPageTab(tab);
    setScreen("mypage");
  }

  function openDetail(id: string) {
    setCurrentDetailId(id);
    setRoleSwitchVisible(false);
    setScreen("detail");
  }

  /* ---- 作成画面 ---- */
  function setDraftPhoto(path: string) {
    setDraft((d) => ({ ...d, photo: path }));
    setSheet(null);
  }

  function startExtraction() {
    setExtracting(true);
    const steps = ["写真を解析しています", "商品を認識しています", "タグを作成しています"];
    let i = 0;
    setLoadingText(steps[0]);
    const interval = window.setInterval(() => {
      i += 1;
      if (i < steps.length) {
        setLoadingText(steps[i]);
        return;
      }
      window.clearInterval(interval);
      setDraft((d) => ({
        ...d,
        tags: mockExtractCandidates.map((m) => {
          tagIdCounter.current += 1;
          return {
            id: `draft${tagIdCounter.current}`,
            x: m.x,
            y: m.y,
            name: m.name,
            category: m.category,
            included: true,
          };
        }),
      }));
      setExtracting(false);
    }, 1200);
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

  function submitCollection() {
    if (draft.tags.length === 0) return;
    const includedTags: ItemTag[] = draft.tags
      .filter((t) => t.included)
      .map((t) => ({
        id: t.id,
        x: t.x,
        y: t.y,
        name: t.name,
        category: t.category,
        status: "未出品",
        wants: [],
      }));
    const newPost: CollectionPost = {
      id: `c${Date.now()}`,
      user: currentUser,
      photo: draft.photo,
      title: draft.title || "(無題)",
      body: draft.body,
      postedAt: "たった今",
      likes: 0,
      liked: false,
      comments: [],
      tags: includedTags,
    };
    onCollectionsChange((prev) => [newPost, ...prev]);
    setDraft(emptyDraft());
    goToMyPage("collection");
  }

  /* ---- 詳細画面 ---- */
  function toggleLike() {
    if (!currentDetail) return;
    const id = currentDetail.id;
    onCollectionsChange((prev) =>
      prev.map((c) => (c.id === id ? { ...c, liked: !c.liked, likes: c.likes + (c.liked ? -1 : 1) } : c))
    );
  }

  function sendComment(text: string) {
    if (!currentDetail) return;
    const id = currentDetail.id;
    onCollectionsChange((prev) =>
      prev.map((c) => (c.id === id ? { ...c, comments: [...c.comments, { user: "あなた", text }] } : c))
    );
  }

  function openBuySheet(tagId: string) {
    setBuyTagId(tagId);
    setBuyPrice(3000);
    setSheet("buy");
  }

  function submitBuy() {
    if (!currentDetail || !buyTagId) return;
    const id = currentDetail.id;
    const tagId = buyTagId;
    const price = buyPrice;
    onCollectionsChange((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              tags: c.tags.map((t) =>
                t.id === tagId
                  ? { ...t, wants: [...t.wants, { from: demoBuyer.name, price, at: "たった今" }] }
                  : t
              ),
            }
          : c
      )
    );
    setSheet(null);
    showToast("伝えました");
    window.setTimeout(() => setRoleSwitchVisible(true), 500);
  }

  /* ---- 投稿者側への切り替え／通知 ---- */
  function handleSwitchRole() {
    if (!currentDetail) return;
    const tag = [...currentDetail.tags].reverse().find((t) => t.wants.length > 0);
    if (!tag) return;
    setNotifTarget({ collectionId: currentDetail.id, tagId: tag.id });
    setScreen("notification");
  }

  function declineList() {
    showToast("また今度、出品するか検討できます");
    goToMyPage("collection");
  }

  function completeSell(values: { name: string; description: string; price: number }) {
    if (!notifTarget) return;
    const { collectionId, tagId } = notifTarget;
    onCollectionsChange((prev) =>
      prev.map((c) =>
        c.id === collectionId
          ? { ...c, tags: c.tags.map((t) => (t.id === tagId ? { ...t, name: values.name, status: "出品中" } : t)) }
          : c
      )
    );
    setCompleteMessage(`「${values.name}」の出品が完了しました。買いたいと伝えてくれた人に届きます。`);
    setScreen("sell-complete");
  }

  let content: ReactNode = null;
  if (screen === "create") {
    content = (
      <CollectionCreateScreen
        draft={draft}
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
    content = (
      <CollectionMyPageScreen
        user={currentUser}
        tab={myPageTab}
        collections={collections}
        onBack={onExit}
        onChangeTab={setMyPageTab}
        onOpenDetail={openDetail}
      />
    );
  } else if (screen === "detail" && currentDetail) {
    content = (
      <CollectionDetailScreen
        post={currentDetail}
        onBack={() => goToMyPage("collection")}
        onToggleLike={toggleLike}
        onSendComment={sendComment}
        onOpenBuySheet={openBuySheet}
        showRoleSwitchBanner={roleSwitchVisible}
        onSwitchRole={handleSwitchRole}
      />
    );
  } else if (screen === "notification" && notifCollection && notifTag && notifWant) {
    content = (
      <CollectionNotificationScreen
        tagName={notifTag.name}
        buyerName={demoBuyer.name}
        buyerAvatar={demoBuyer.avatar}
        price={notifWant.price}
        onBack={() => goToMyPage("collection")}
        onDecline={declineList}
        onStartSell={() => setScreen("sell")}
      />
    );
  } else if (screen === "sell" && notifCollection && notifTag && notifWant) {
    content = (
      <CollectionSellScreen
        photo={notifCollection.photo}
        initialName={notifTag.name}
        initialDescription={notifCollection.body}
        category={notifTag.category}
        initialPrice={notifWant.price}
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

      <div
        className={`sheet-backdrop${sheet ? " open" : ""}`}
        onClick={() => setSheet(null)}
      />
      <div className={`sheet${sheet === "photo" ? " open" : ""}`}>
        <div className="sheet-handle" />
        <div className="sheet-title">写真を追加</div>
        <button type="button" className="sheet-option" onClick={() => setDraftPhoto("photos/room-01.jpg")}>
          📷 カメラで撮影
        </button>
        <button type="button" className="sheet-option" onClick={() => setDraftPhoto("photos/room-01.jpg")}>
          🖼 アルバムから選ぶ
        </button>
        <button type="button" className="sheet-cancel" onClick={() => setSheet(null)}>
          キャンセル
        </button>
      </div>
      <div className={`sheet${sheet === "buy" ? " open" : ""}`}>
        <div className="sheet-handle" />
        <div className="sheet-title">この商品を買いたいと伝えます</div>
        <p className="hero-sub" style={{ marginBottom: 12 }}>
          対象：<b>{buyTargetTag?.name}</b>
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
          {currentDetail?.user.name}さんに通知されます。出品するかどうかは相手が決めます。
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
