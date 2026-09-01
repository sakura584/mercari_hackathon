import { onImgError } from "@/lib/collection-mock-data";
import type { CollectionPost, CollectionUser, MyPageTab } from "@/lib/collection-types";

const TABS: { key: MyPageTab; label: string }[] = [
  { key: "selling", label: "出品中" },
  { key: "collection", label: "コレクション" },
  { key: "bought", label: "購入した商品" },
];

export function CollectionMyPageScreen({
  user,
  tab,
  collections,
  onBack,
  onChangeTab,
  onOpenDetail,
}: {
  user: CollectionUser;
  tab: MyPageTab;
  collections: CollectionPost[];
  onBack: () => void;
  onChangeTab: (tab: MyPageTab) => void;
  onOpenDetail: (id: string) => void;
}) {
  return (
    <section className="screen active">
      <div className="app-bar">
        <button type="button" className="back-chevron" onClick={onBack}>
          ←
        </button>
        <div className="app-bar-title">マイページ</div>
      </div>
      <div className="screen-scroll" style={{ padding: 0 }}>
        <div className="mypage-header">
          <div className="mypage-avatar">{user.avatar}</div>
          <div>
            <div className="mypage-name">{user.name}</div>
            <div className="mypage-sub">評価：{user.rating}</div>
          </div>
        </div>
        <div className="collection-profile-tabs">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`collection-profile-tab${tab === t.key ? " active" : ""}`}
              onClick={() => onChangeTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "collection" ? (
          collections.length > 0 ? (
            <div className="collection-grid">
              {collections.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="collection-cell"
                  onClick={() => onOpenDetail(c.id)}
                >
                  <div className="collection-cell-photo-wrap">
                    <img src={c.photo ?? undefined} onError={onImgError} alt="" />
                    <div className="collection-tag-count-badge">🏷 {c.tags.length}</div>
                  </div>
                  <div className="collection-cell-meta">♡ {c.likes}</div>
                </button>
              ))}
            </div>
          ) : (
            <div className="collection-empty-state">まだコレクションがありません</div>
          )
        ) : tab === "selling" ? (
          <div className="collection-empty-state">出品中の商品はありません</div>
        ) : (
          <div className="collection-empty-state">購入した商品はありません</div>
        )}
      </div>
    </section>
  );
}
