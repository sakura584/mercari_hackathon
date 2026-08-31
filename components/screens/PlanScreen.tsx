import type { Item } from "@/lib/types";

export function PlanScreen({
  items,
  targetAmount,
  onViewAlbum,
}: {
  items: Item[];
  targetAmount: number;
  onViewAlbum: () => void;
}) {
  const soldItems = items.filter((item) => item.finalDecision === "let_go");
  const total = soldItems.reduce((sum, item) => sum + (item.estimatedPrice ?? 0), 0);
  const remaining = Math.max(targetAmount - total, 0);

  return (
    <section className="screen active">
      <div className="app-bar">
        <div className="app-bar-title">売却プラン</div>
      </div>
      <div className="screen-scroll">
        <div className="summary-bar">
          <div className="summary-tile">
            <div className="stile-label">売ると決めた合計</div>
            <div className="stile-value">¥{total.toLocaleString("ja-JP")}</div>
          </div>
          <div className="summary-tile">
            <div className="stile-label">目標まであと</div>
            <div className="stile-value">¥{remaining.toLocaleString("ja-JP")}</div>
          </div>
        </div>
        <div className="candidate-list">
          {soldItems.map((item) => (
            <div key={item.id} className="final-row">
              <span className="mi-name">{item.title}</span>
              <span className="mi-price">¥{(item.estimatedPrice ?? 0).toLocaleString("ja-JP")}</span>
            </div>
          ))}
        </div>
        <button type="button" className="cta" style={{ marginTop: 20 }} onClick={onViewAlbum}>
          手放したもののアルバムを見る
        </button>
      </div>
    </section>
  );
}
