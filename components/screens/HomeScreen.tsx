export function HomeScreen({
  onStart,
  onOpenCollectionCreate,
  onOpenCollectionMyPage,
}: {
  onStart: () => void;
  onOpenCollectionCreate: () => void;
  onOpenCollectionMyPage: () => void;
}) {
  return (
    <section className="screen active">
      <div className="home-header">
        <div className="mercari-wordmark">mercari</div>
        <div className="search-bar">🔍 なにをお探しですか？</div>
        <div className="bell-wrap">
          🔔<span className="bell-dot" />
        </div>
      </div>
      <div className="home-scroll">
        <button type="button" className="promo-banner" onClick={onStart}>
          <span className="pb-icon">🧹</span>
          <span className="pb-text">そろそろ持ち物を整理しませんか？思い出を残しながら手放せます</span>
          <span className="pb-chevron">›</span>
        </button>
      </div>
      <div className="tab-bar">
        <button type="button" className="tab-item active">
          <span className="tab-icon">🏠</span>ホーム
        </button>
        <button type="button" className="tab-item">
          <span className="tab-icon">🔍</span>検索
        </button>
        <button type="button" className="tab-item" onClick={onOpenCollectionCreate}>
          <span className="tab-icon">🏷</span>コレクション
        </button>
        <button type="button" className="tab-item tab-sell">
          <span className="tab-icon">📷</span>出品
        </button>
        <button type="button" className="tab-item">
          <span className="tab-icon">🔔</span>お知らせ
        </button>
        <button type="button" className="tab-item" onClick={onOpenCollectionMyPage}>
          <span className="tab-icon">👤</span>マイページ
        </button>
      </div>
    </section>
  );
}
