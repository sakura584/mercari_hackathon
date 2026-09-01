export function CollectionNotificationScreen({
  tagName,
  buyerName,
  buyerAvatar,
  price,
  reason,
  onBack,
  onDecline,
  onStartSell,
}: {
  tagName: string;
  buyerName?: string;
  buyerAvatar?: string;
  price?: number;
  reason?: string;
  onBack: () => void;
  onDecline: () => void;
  onStartSell: () => void;
}) {
  const isAiSuggestion = !buyerName;
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
            』{isAiSuggestion ? "について、AIから手放しの提案があります" : "に、買いたいという人がいます"}
          </p>
          <div className="collection-detail-user-row" style={{ padding: 0, marginBottom: 16 }}>
            {isAiSuggestion ? (
              <div>
                <div className="collection-detail-user-name">AIからの提案</div>
                <div className="collection-notif-price">{reason}</div>
              </div>
            ) : (
              <>
                <div className="mypage-avatar" style={{ width: 34, height: 34, fontSize: 13 }}>
                  {buyerAvatar}
                </div>
                <div>
                  <div className="collection-detail-user-name">{buyerName}さん</div>
                  <div className="collection-notif-price">
                    希望金額 ¥{(price ?? 0).toLocaleString("ja-JP")}
                  </div>
                </div>
              </>
            )}
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
