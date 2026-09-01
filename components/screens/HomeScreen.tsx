import { onImgError } from "@/lib/collection-mock-data";

const CATEGORY_TABS = ["おすすめ", "レディース", "メンズ", "ベビー・キッズ", "インテリア", "本・音楽・ゲーム"];

const HOME_ITEMS = [
  { photo: "photos/p1.jpg", price: "3,200", title: "ヴィンテージ木製チェア" },
  { photo: "photos/p2.jpg", price: "980", title: "コーヒーミル 手動" },
  { photo: "photos/p3.jpg", price: "5,500", title: "デニムジャケット Mサイズ" },
  { photo: "photos/p4.jpg", price: "1,200", title: "陶器の一輪挿し" },
  { photo: "photos/p5.jpg", price: "7,800", title: "折りたたみ自転車" },
  { photo: "photos/p6.jpg", price: "450", title: "文庫本 5冊セット" },
];

export function HomeScreen({
  onOpenCollectionCreate,
  onOpenCollectionMyPage,
}: {
  onOpenCollectionCreate: () => void;
  onOpenCollectionMyPage: () => void;
}) {
  return (
    <section className="screen active">
      <div className="app-header">
        <div className="logo-row">
          <div className="logo">mercari</div>
          <div className="search-box">なにをお探しですか？</div>
        </div>
        <div className="category-tabs">
          {CATEGORY_TABS.map((label, i) => (
            <span key={label} className={i === 0 ? "active" : undefined}>
              {label}
            </span>
          ))}
        </div>
      </div>
      <div className="screen-body">
        <div className="product-grid">
          {HOME_ITEMS.map((item) => (
            <div key={item.title} className="product-card">
              <img className="product-photo" src={item.photo} onError={onImgError} alt="" />
              <div className="product-price">¥{item.price}</div>
              <div className="product-title">{item.title}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="tabbar">
        <button type="button" className="tab-item active">
          <span className="tab-icon">⌂</span>ホーム
        </button>
        <button type="button" className="tab-item">
          <span className="tab-icon">⌕</span>さがす
        </button>
        <button type="button" className="tab-item" onClick={onOpenCollectionCreate}>
          <span className="collection-icon">
            <span className="sq sq1" />
            <span className="sq sq2" />
          </span>
          コレクション
        </button>
        <div className="tab-sell">
          <button type="button" className="tab-sell-btn">
            ＋
          </button>
        </div>
        <button type="button" className="tab-item">
          <span className="tab-icon">♡</span>お知らせ
        </button>
        <button type="button" className="tab-item" onClick={onOpenCollectionMyPage}>
          <span className="tab-icon">☺</span>マイページ
        </button>
      </div>
    </section>
  );
}
