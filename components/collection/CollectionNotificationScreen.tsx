export function CollectionNotificationScreen({
  tagName,
  buyerName,
  buyerAvatar,
  price,
  onBack,
  onDecline,
  onStartSell,
}: {
  tagName: string;
  buyerName: string;
  buyerAvatar: string;
  price: number;
  onBack: () => void;
  onDecline: () => void;
  onStartSell: () => void;
}) {
  return (
    <section className="screen active">
      <div className="app-bar">
        <button type="button" className="back-chevron" onClick={onBack}>
          ←
        </button>
        <div className="app-bar-title">お知らせ</div>
      </div>
      <div className="screen-scroll">
        <div className="card">
          <p className="hero-sub" style={{ marginBottom: 14 }}>
            あなたのコレクションの『<b style={{ color: "var(--brand)" }}>{tagName}</b>
            』に、買いたいという人がいます
          </p>
          <div className="collection-detail-user-row" style={{ padding: 0, marginBottom: 16 }}>
            <div className="mypage-avatar" style={{ width: 34, height: 34, fontSize: 13 }}>
              {buyerAvatar}
            </div>
            <div>
              <div className="collection-detail-user-name">{buyerName}さん</div>
              <div className="collection-notif-price">希望金額 ¥{price.toLocaleString("ja-JP")}</div>
            </div>
          </div>
          <div className="decision-row">
            <button type="button" className="cta ghost" onClick={onDecline}>
              今は出品しない
            </button>
            <button type="button" className="cta" style={{ marginTop: 0 }} onClick={onStartSell}>
              出品する
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
