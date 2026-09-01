"use client";

import { useState } from "react";
import { onImgError } from "@/lib/collection-mock-data";
import type { CollectionDraft, DraftTag } from "@/lib/collection-types";
import { TagPinLayer } from "./TagPinLayer";

export function CollectionCreateScreen({
  draft,
  extracting,
  onBack,
  onOpenPhotoSheet,
  onStartExtraction,
  onToggleTagIncluded,
  onUpdateTagName,
  onChangeTitle,
  onChangeBody,
  onSubmit,
}: {
  draft: CollectionDraft;
  extracting: boolean;
  onBack: () => void;
  onOpenPhotoSheet: () => void;
  onStartExtraction: () => void;
  onToggleTagIncluded: (id: string) => void;
  onUpdateTagName: (id: string, name: string) => void;
  onChangeTitle: (title: string) => void;
  onChangeBody: (body: string) => void;
  onSubmit: () => void;
}) {
  const [activeTag, setActiveTag] = useState<DraftTag | null>(null);
  const visibleTags = draft.tags.filter((t) => t.included);
  const canSubmit = draft.tags.length > 0 && !extracting;

  return (
    <section className="screen active">
      <div className="app-bar">
        <button type="button" className="back-chevron" onClick={onBack}>
          ←
        </button>
        <div className="app-bar-title">コレクションを作成</div>
      </div>
      <div className="screen-scroll">
        {!draft.photo ? (
          <div className="collection-photo-empty">
            <button
              type="button"
              className="cta ghost"
              style={{ width: "auto" }}
              onClick={onOpenPhotoSheet}
            >
              ＋ 写真を追加
            </button>
          </div>
        ) : (
          <div
            className="collection-photo-area collection-photo-area--framed"
            onClick={() => setActiveTag(null)}
          >
            <img src={draft.photo} onError={onImgError} alt="" />
            <TagPinLayer
              tags={visibleTags}
              activeTag={activeTag}
              onPinClick={setActiveTag}
              renderPopup={(tag) => (
                <>
                  <div className="tp-name">{tag.name}</div>
                  <div className="tp-cat">{tag.category}</div>
                </>
              )}
            />
          </div>
        )}

        {draft.photo && draft.tags.length === 0 ? (
          <button
            type="button"
            className="cta"
            disabled={extracting}
            onClick={onStartExtraction}
          >
            {extracting ? "解析中…" : "商品を抽出する"}
          </button>
        ) : null}

        {draft.tags.length > 0 ? (
          <>
            <div className="section-title" style={{ marginTop: 20 }}>
              認識された商品
            </div>
            {draft.tags.map((tag) => (
              <div key={tag.id} className={`collection-tag-row${tag.included ? "" : " excluded"}`}>
                <div className="collection-tag-row-info">
                  <input
                    className="collection-tag-name-input"
                    value={tag.name}
                    onChange={(e) => onUpdateTagName(tag.id, e.target.value)}
                  />
                  <div className="collection-tag-category">{tag.category}</div>
                </div>
                <button
                  type="button"
                  className={`collection-switch${tag.included ? " on" : ""}`}
                  onClick={() => onToggleTagIncluded(tag.id)}
                  aria-label="含める/除外する"
                >
                  <span className="collection-switch-knob" />
                </button>
              </div>
            ))}
          </>
        ) : null}

        <div className="draft-field" style={{ marginTop: 20 }}>
          <label>タイトル</label>
          <input
            className="draft-input"
            placeholder="タイトルを入力"
            value={draft.title}
            onChange={(e) => onChangeTitle(e.target.value)}
          />
        </div>
        <div className="draft-field">
          <label>説明文</label>
          <textarea
            className="draft-textarea"
            placeholder="説明文を入力"
            value={draft.body}
            onChange={(e) => onChangeBody(e.target.value)}
          />
        </div>

        <button type="button" className="cta" disabled={!canSubmit} onClick={onSubmit}>
          投稿する
        </button>
      </div>
    </section>
  );
}
