export function CollectionSellCompleteScreen({
  message,
  onBackToCollection,
}: {
  message: string;
  onBackToCollection: () => void;
}) {
  return (
    <section className="screen active">
      <div className="app-bar">
        <div className="app-bar-title">完了</div>
      </div>
      <div className="screen-scroll draft-success">
        <div className="ds-icon">✓</div>
        <div className="ds-title">出品しました</div>
        <p className="ds-sub">{message}</p>
        <button type="button" className="cta" onClick={onBackToCollection}>
          コレクションに戻る
        </button>
      </div>
    </section>
  );
}
