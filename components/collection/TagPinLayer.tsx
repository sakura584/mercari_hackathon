import type { ReactNode } from "react";

type PinLike = { id: string; x: number; y: number };

/**
 * 写真の上に絶対配置のピンを重ねて表示する共通レイヤー。
 * 呼び出し側は表示すべきタグ（除外済み/非表示は事前にフィルタ）と、
 * アクティブなタグのポップアップ内容を渡す。
 * ポップアップを閉じる操作（写真の余白タップ）は親要素の onClick 側で行う想定。
 */
export function TagPinLayer<T extends PinLike>({
  tags,
  activeTag,
  onPinClick,
  renderPopup,
}: {
  tags: T[];
  activeTag: T | null;
  onPinClick: (tag: T) => void;
  renderPopup: (tag: T) => ReactNode;
}) {
  return (
    <>
      {tags.map((tag) => (
        <button
          key={tag.id}
          type="button"
          className="collection-pin"
          style={{ left: `${tag.x}%`, top: `${tag.y}%` }}
          onClick={(e) => {
            e.stopPropagation();
            onPinClick(tag);
          }}
          aria-label="タグ"
        />
      ))}
      {activeTag ? (
        <div
          className="collection-tag-popup"
          style={{ left: `${activeTag.x}%`, top: `${activeTag.y}%` }}
          onClick={(e) => e.stopPropagation()}
        >
          {renderPopup(activeTag)}
        </div>
      ) : null}
    </>
  );
}
